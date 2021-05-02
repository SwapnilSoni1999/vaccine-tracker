const { Telegraf, Scenes, session, TelegramError } = require('telegraf')
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const CoWIN = require('./wrapper')

const BOT_TOKEN = '1707560756:AAGklCxSVVtfEtPBYEmOCZW6of4nEzffhx0'
const bot = new Telegraf(BOT_TOKEN)
const INVITE_KEY = "C0WiNbotSwapnil"

const adapter = new FileSync('db.json')
const db = low(adapter)
db.defaults({ users: [] }).write()

const Users = db.get('users')

/**
 * Helper methods
 */

const SNOOZE_LITERALS = [
    { name: '10min', seconds: 10 * 60 },
    { name: '20min', seconds: 20 * 60 },
    { name: '45min', seconds: 45 * 60 },
    { name: '1hr', seconds: 1 * 60 * 60 },
    { name: '2hr', seconds: 2 * 60 * 60 },
    { name: '4hr', seconds: 4 * 60 * 60 },
    { name: '6hr', seconds: 6 * 60 * 60 },
    { name: '8hr', seconds: 8 * 60 * 60 },
    { name: '10hr', seconds: 10 * 60 * 60 },
    { name: '12hr', seconds: 12 * 60 * 60 },
    { name: '18hr', seconds: 18 * 60 * 60 }
]

const _isAuth = (chatId) => {
    const { token } = Users.find({ chatId }).pick('token').value()
    return !!token 
}

const _isInvited = (chatId) => {
    const { allowed } = Users.find({ chatId }).pick('allowed').value()
    return !!allowed
}

function secondsToHms(d) {
    d = Number(d);
    var h = Math.floor(d / 3600);
    var m = Math.floor(d % 3600 / 60);
    var s = Math.floor(d % 3600 % 60);

    var hDisplay = h > 0 ? h + (h == 1 ? " hour, " : " hours, ") : "";
    var mDisplay = m > 0 ? m + (m == 1 ? " minute, " : " minutes, ") : "";
    var sDisplay = s > 0 ? s + (s == 1 ? " second" : " seconds") : "";
    return hDisplay + mDisplay + sDisplay; 
}


/**
 * Middlewares
 */

const authMiddle = async (ctx, next) => {
    if (_isAuth(ctx.chat.id)) {
        next()
    } else {
        return await ctx.reply('Sorry! You\'re not logged in! Please /login first.')
    }
}

const inviteMiddle = async (ctx, next) => {
    if(_isInvited(ctx.chat.id)) {
        next()
    } else {
        return await ctx.reply('Please verify yourself by providing invite code!\nSend /start to invite yourself.')
    }
}

const groupDetection = async (ctx, next) => {
    try {
        if(String(ctx.chat.id).startsWith('-')) {
            await ctx.reply('This bot is not operatable in groups!')
            return await ctx.leaveChat()
        }
        next()
    } catch (err) { }
}

/**
 * Wizards
 */

const inviteWizard = new Scenes.WizardScene(
    'invite',
    async (ctx) => {
        try {
            ctx.reply('Send invitation code to access this bot!')
            return ctx.wizard.next()
        } catch (error) {
            console.log(error)
            await ctx.reply('Some error occured please retry again with /start!')
            return ctx.scene.leave()
        }
    },
    async (ctx) => {
        try {
            const code = ctx.message.text.trim()
            if (!Users.find({ chatId: ctx.chat.id }).value()) {
                Users.push({ chatId: ctx.chat.id }).write()
            }
            if (code == INVITE_KEY) {
                Users.find({ chatId: ctx.chat.id }).assign({ allowed: true }).write()
                await ctx.reply('Invitation accepted!')
                const msg = `Hi, This bot can operate on selfregistration.cowin.gov.in.\nYou can send /help to know instructions about how to use this bot.\nDeveloped by <a href="https://github.com/SwapnilSoni1999">Swapnil Soni</a>`
                await ctx.reply(msg, { parse_mode: 'HTML' })
                return ctx.scene.leave()
            } else {
                Users.find({ chatId: ctx.chat.id }).assign({ allowed: false }).write()
                await ctx.reply('Wrong invitation code. Please try again with /start if you wish to.')
                return ctx.scene.leave()
            }
        } catch (error) {
            console.log(error)
            await ctx.reply('Some error occured please retry again with /start!')
            return ctx.scene.leave()
        }
    }
)

const loginWizard = new Scenes.WizardScene(
    'login',
    async (ctx) => {
        try {
            ctx.reply('Send your phone number (10 digits only)')
            return ctx.wizard.next()
        } catch (error) {
            console.log(error)
            await ctx.reply('Some error occured please retry!')
            ctx.scene.leave()
        }
    },
    async (ctx) => {
        try {
            const mobile = ctx.message.text.trim()
            ctx.wizard.state.mobile = mobile
            if (mobile.length != 10) {
                await ctx.reply('Please send 10 digit mobile number!')
                return ctx.scene.leave()
            }
            const isnum = /^\d+$/.test(mobile)
            if (!isnum) {
                await ctx.reply('Please provide numbers only!')
                return ctx.scene.leave()
            }
            try {
                const cowin = new CoWIN(mobile)
                ctx.wizard.state.cowin = cowin
                const MAX_TIMEOUT_OTP = 180 //sec
                const currentTime = parseInt(Date.now() / 1000)
                const { lastOtpRequested } = Users.find({ chatId: ctx.chat.id }).pick('lastOtpRequested').value()
                if (currentTime - lastOtpRequested < MAX_TIMEOUT_OTP) {
                    await ctx.reply(`Please wait ${Math.abs(currentTime - (lastOtpRequested + MAX_TIMEOUT_OTP))} seconds before requesting for new otp.`)
                    return ctx.scene.leave()
                }
                await ctx.wizard.state.cowin.sendOtp()
                Users.find({ chatId: ctx.chat.id }).assign({ lastOtpRequested: parseInt(Date.now()/1000) }).write()
                Users.find({ chatId: ctx.chat.id }).assign({ txnId: ctx.wizard.state.cowin.txnId }).write()
            } catch (err) {
                console.log(err)
                await ctx.reply('Error while sending otp!\nPlease try again!')
                return ctx.scene.leave()
            }
            
            await ctx.reply('Enter your otp')
            return ctx.wizard.next()
        } catch (error) {
            console.log(error)
            await ctx.reply('Some error occured please retry!')
            ctx.scene.leave()
        }
    },
    async (ctx) => {
        try {
            const otp = ctx.message.text.trim()
            const isnum = /^\d+$/.test(otp)
            if (!isnum) {
                await ctx.reply('Please provide numbers only!')
                return ctx.scene.leave()
            }
            try {
                await ctx.wizard.state.cowin.verifyOtp(otp)
                Users.find({ chatId: ctx.chat.id }).assign({ token: ctx.wizard.state.cowin.token }).write()
                await ctx.reply('Login successful!')
                Users.find({ chatId: ctx.chat.id }).assign({ mobile: ctx.wizard.state.mobile, informedExpiration: false }).write()
                await ctx.reply('Send /help to know further commands.')
                return ctx.scene.leave()
            } catch (err) {
                console.log(err)
                await ctx.reply('Invalid otp!\nYou can try again with /otp <your-otp>')
                return ctx.scene.leave()
            }
        } catch (error) {
            console.log(error)
            await ctx.reply('Some error occured please retry!')
            ctx.scene.leave()
        }
    }
)

loginWizard.command('cancel', async (ctx) => {
    await ctx.scene.leave()
    return await ctx.reply('Operation cancelled!')
})

const slotWizard = new Scenes.WizardScene(
    'slot-booking',
    async (ctx) => {
        try {
            ctx.reply('Send your pincode')  
            return ctx.wizard.next()
        } catch (error) {
            console.log(error)
            await ctx.reply('Some error occured please retry!')
            return ctx.scene.leave()
        }
    },
    async (ctx) => {
        try {
            const pincode = ctx.message.text.trim()
            if (pincode.length !== 6) {
                await ctx.reply('Please provide valid pincode!')
                return ctx.scene.leave()
            }
            const isnum = /^\d+$/.test(pincode)
            if (!isnum) {
                await ctx.reply('Please provide numbers only!')
                return ctx.scene.leave()
            }
            ctx.wizard.state.pincode = pincode
            Users.find({ chatId: ctx.chat.id }).assign({ pincode }).write()
            await ctx.reply('Please choose age group.', { reply_markup: 
                {
                    inline_keyboard:[
                        [ { text: '18+', callback_data: '18_plus' }, { text: '45+', callback_data: '45_plus' } ]
                    ]
                }
            })

            return ctx.wizard.next()
        } catch(err) {
            if (err.response.status == 401) {
                await ctx.reply('No slots available for this pin!')
                return ctx.scene.leave()
            }
            console.log(err)
            await ctx.reply('Some error occured please retry!')
            return ctx.scene.leave()
        }
    },
    async (ctx) => {
        try {
            const { pincode } = Users.find({ chatId: ctx.chat.id }).pick('pincode').value()
            ctx.wizard.state.pincode = pincode
            const { age_group } = Users.find({ chatId: ctx.chat.id }).pick('age_group').value()
            if (!age_group || !pincode) {
                await ctx.reply('Please select valid age group and provide valid pincode and try again.')
                return ctx.scene.leave()
            }
            await ctx.reply(`Your provided Information.\n<b>Pincode</b>: ${ctx.wizard.state.pincode}\n<b>Age group</b>: ${age_group}+\nIf it is correct then send 👍 else 👎`, { parse_mode: 'HTML' })
            return ctx.wizard.next()
        } catch (err) {
            console.log(err)
            await ctx.reply('Some error occured please retry!')
            return ctx.scene.leave()
        }
    },
    async (ctx) => {
        try {
            const confirmed = ctx.message.text
            if (confirmed == '👍') {
                await ctx.reply('Request accepted!')
                Users.find({ chatId: ctx.chat.id }).assign({ pincode: ctx.wizard.state.pincode }).write()
                await ctx.reply('Now, You\'ll be notified as soon as the vaccine will be available in your desired pincode. Please take a note that this bot is in experimental mode. You may or may not receive messages. So please check the portal by yourself as well. Also if you find some issues then please let me know @SoniSins')
                return ctx.scene.leave()
            } else {
                await ctx.reply('Request declined!')
                Users.find({ chatId: ctx.chat.id }).assign({ pincode: null }).assign({ age_group: null }).write()
                return ctx.scene.leave()
            }
        } catch (error) {
            console.log(error)
            await ctx.reply('Some error occured please retry!')
            return ctx.scene.leave()
        }
    }
)

bot.action('18_plus', async (ctx) => {
    const chatId = ctx.update.callback_query.from.id
    Users.find({ chatId }).assign({ age_group: 18 }).write()
    return await ctx.editMessageText('Selected 18+ age group.\nSend any text to continue...')
    // return ctx.scene.enter('track-pt2')
})

bot.action('45_plus', async (ctx) => {
    const chatId = ctx.update.callback_query.from.id
    Users.find({ chatId }).assign({ age_group: 45 }).write()
    return await ctx.editMessageText('Selected 45+ age group.\nSend any text to continue...')
    // return ctx.scene.enter('track-pt2')
})

const stage = new Scenes.Stage([loginWizard, slotWizard, inviteWizard])

bot.use(session())
bot.use(groupDetection)
bot.use(stage.middleware())

/**
 * Commands
 */

bot.help(inviteMiddle, async (ctx) => {
    let commands = ``
    if (_isAuth(ctx.chat.id)) {
        commands += `/beneficiaries = to list beneficiaries\n/logout = logout from the bot/portal\n`
    }
    commands += `/snooze = To pause messages for several given time\n/unsnooze = remove message pause and get message on every ~1min interval\n/login = To login with your number!\n/track = to track available slot with given pincode.\n/untrack = untrack your current pincode\n/otp <your-otp> = during auth if your otp is wrong then you can try again wth /otp command\n/status = check your status`
    return ctx.reply(commands)
})

bot.start(async (ctx) => {
    if (_isInvited(ctx.chat.id)) {
        const msg = `Hi, This bot can operate on selfregistration.cowin.gov.in.\nYou can send /help to know instructions about how to use this bot.\nDeveloped by <a href="https://github.com/SwapnilSoni1999">Swapnil Soni</a>`
        return await ctx.reply(msg, { parse_mode: 'HTML' })
    }
    ctx.scene.enter('invite')
})

bot.command('login', inviteMiddle, async (ctx) => {
    const user = Users.find({ chatId: ctx.chat.id }).value()
    if (user) {
        if (user.token) {
            return await ctx.reply('You\'re already logged in! Send /logout to Logout.')
        }
    }
    ctx.scene.enter('login')
})

bot.command('otp', inviteMiddle, async (ctx) => {
    const user = Users.find({ chatId: ctx.chat.id }).value()
    if (user.token) {
        return await ctx.reply('You\'re already logged in! Send /logout to Logout.')
    }

    if(!user.txnId) {
        return await ctx.reply('You\'ve not initialized login process. Please send /login to continue.')
    }

    try {
        const token = await CoWIN.verifyOtpStatic(ctx.message.text.split(' ')[1], user.txnId)
        Users.find({ chatId: ctx.chat.id }).assign({ token: token }).write()
        return await ctx.reply('Login successful!')
    } catch (err) {
        console.log(err)
        return await ctx.reply('Wrong otp! Please try again with /otp <your-otp>')
    }
})

bot.command('logout', inviteMiddle, async (ctx) => {
    const user = Users.find({ chatId: ctx.chat.id }).value()
    if (!user.token) {
        return await ctx.reply('You\'re not logged in! Please /login first.')
    }
    if (user.txnId) {
        Users.find({ chatId: ctx.chat.id }).assign({ txnId: null }).write()
    }
    Users.find({ chatId: ctx.chat.id }).assign({ token: null }).write()
    return await ctx.reply('Logged out! Send /login to login.')
})

function expandAppointments(appointments) {
    // seperated by \n at end \t at begining
    const appintmentMap = appointments.map(ap => `There ${appointments.length > 1 ? 'are': 'is'} ${appointments.length} appointment${appointments.length>1? 's': ''} Booked.\n\t<b>Center Name</b>: ${ap.name}\n\t<b>District</b>: ${ap.district}\n\t<b>Block</b>: ${ap.block_name}\n\t<b>Center Timings</b>:\n\t\t<u><b>From</b></u>: ${ap.from}\n\t\t<u><b>To</b></u>: ${ap.to}\n\t<b>Dose</b>: ${ap.dose}\n\t<b>Date</b>: ${ap.date}\n\t<u><b>Your time Slot</b></u>: <u>${ap.slot}</u>`)
    return appintmentMap.join("\n")
}


bot.command('beneficiaries', inviteMiddle, async (ctx) => {
    const { token } = Users.find({ chatId: ctx.chat.id }).pick('token').value()
    try {
        const ben = await CoWIN.getBeneficiariesStatic(token)
        Users.find({ chatId: ctx.chat.id }).assign({ beneficiaries: ben }).write()
        const txts = ben.map(b => `<b>ID:</b> ${b.beneficiary_reference_id}\n<b>Name</b>: ${b.name}\n<b>Birth Year</b>: ${b.birth_year}\n<b>Gender</b>: ${b.gender}\n<b>Vaccination Status</b>: ${b.vaccination_status}\n<b>Vaccine</b>: ${b.vaccine}\n<b>Dose 1 Date</b>: ${b.dose1_date || 'Not vaccinated'}\n<b>Dose 2 Date</b>: ${b.dose2_date || 'Not vaccinated'}\n\n<b>Appointments</b>: ${b.appointments.length ? expandAppointments(b.appointments) : 'No appointments booked.'}\n\n<u>It is recommended to take both doses of same vaccines. Please do not take different vaccine doeses.</u>`)
        
        for (const txt of txts) {
            await ctx.reply(txt, { parse_mode: 'HTML' })
        }
        return
    } catch (err) {
        if(err.response.status == 401) {
            Users.find({ chatId: ctx.chat.id }).assign({ token: null }).assign({ txnId: null }).write()
            return await ctx.reply('Token expired! Please /login again.')
        }
        return await ctx.reply('Something went wrong please try again later!')
    }
})

bot.command('track', inviteMiddle, authMiddle, async (ctx) => {
    try {
        const { pincode } = Users.find({ chatId: ctx.chat.id }).pick('pincode').value()
        if (pincode) {
            return await ctx.reply('You\'re already tracking a pincode which is ' + pincode + ' please /untrack first then /track.')
        }
        return ctx.scene.enter('slot-booking')
    } catch (err) {
        console.log(err)
        return await ctx.reply('Something went wrong please try again later!')
    }
})

bot.command('untrack', inviteMiddle, async (ctx) => {
    try {
        const { pincode } = Users.find({ chatId: ctx.chat.id }).pick('pincode').value()
        if (pincode) {
            Users.find({ chatId: ctx.chat.id }).assign({ pincode: null }).write()
            return await ctx.reply('Removed pincode tracking for ' + pincode)
        }
        return await ctx.reply('You aren\'t tracking any pincode! Send /track to start tracking.')
    } catch (error) {
        console.log(err)
        return await ctx.reply('Something went wrong please try again later!')
    }
})

bot.command('snooze', async (ctx) => {
    const markupButton = []
    const row = []
    for (let i=0; i<SNOOZE_LITERALS.length; i++) {
        const lit = SNOOZE_LITERALS[i]
        const buttonMarkup = { text: lit.name, callback_data: `snooze_req--${lit.seconds}` }
        row.push(buttonMarkup)
        // console.log(row)
        if (row.length == 2) {
            markupButton.push(row.slice())
            row.splice(0, row.length)
        }
    }
    return await ctx.reply('Choose a time to snooze.', { reply_markup: {
        inline_keyboard: markupButton
    } })
})

bot.command('unsnooze', async (ctx) => {
    Users.find({ chatId: ctx.chat.id }).assign({ snoozeTime: null }).write()
    return await ctx.reply('Unsoozed! You can /snooze your messages if they\'re annoying.')
})

bot.command('status', async (ctx) => {
    const user = Users.find({ chatId: ctx.chat.id }).value()
    return await ctx.reply(`<b>ChatId</b>: ${user.chatId}\n<b>SnoozeTime</b>: ${secondsToHms(user.snoozeTime - user.snoozedAt) || 'Not snoozed'}\n<b>Tracking Pincode</b>: ${user.pincode || 'No pincode'}\n<b>Tracking Age Group:</b>: ${user.age_group ? user.age_group + '+' : 'No age group'}\n\nType /help for more info.`, { parse_mode: 'HTML' })
})

bot.action(/snooze_req--\d+/, async (ctx) => {
    const seconds = ctx.update.callback_query.data.split('snooze_req--')[1]
    const lit = SNOOZE_LITERALS.find(v => v.seconds === parseInt(seconds))
    await ctx.editMessageText(`You've snoozed bot messages for ${lit.name}\nYou can unsnooze using /unsnooze`)
    const currentTime = parseInt(Date.now()/1000)
    Users.find({ chatId: ctx.update.callback_query.from.id }).assign({ snoozeTime: currentTime + lit.seconds, snoozedAt: currentTime }).write()
})

function sleep(ms) {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve(), ms)
    })
}

async function trackAndInform() {
    console.log('Fetching information')
    const users = Users.value()
    const userdata = users.reduce((a, v) => {
        if (v.pincode) {
            a.push({ pincode: v.pincode, token: v.token, chatId: v.chatId })
        }
        return a
    }, [])
    const total = []
    for (const ud of userdata) {
        try {
            const centers = await CoWIN.getCenters(ud.pincode, ud.token)
            await sleep(1000)
            console.log("PIN:", ud.pincode, "Centers:", centers.length)
            const available = centers.filter(center => { 
                const sessions = center.sessions.filter(session => session.available_capacity > 0)
                center.sessions = sessions
                if (center.sessions.length) {
                    return center
                }
            })
            total.push(available)
        } catch (err) {
            const { retriesCount } = Users.find({ chatId: ud.chatId }).pick('retriesCount').value()
            console.log('Retries count', retriesCount)
            if (retriesCount == undefined || retriesCount == null) {
                Users.find({ chatId: ud.chatId }).assign({ retriesCount: 0 }).write()
            }
            Users.find({ chatId: ud.chatId }).assign({ retriesCount: retriesCount + 1 }).write()
            if (retriesCount % 20 == 0) {
                const { informedExpiration } = Users.find({ chatId: ud.chatId }).pick('informedExpiration').value()
                if (!informedExpiration) {
                    try {
                        await bot.telegram.sendMessage(ud.chatId, 'Token expired! Please login again!')
                        Users.find({ chatId: ud.chatId }).assign({ informedExpiration: true }).write()
                    } catch (err) {
                        if (err instanceof TelegramError) {
                            Users.remove({ chatId: ud.chatId }).write()
                            console.log('Removed chatId because bot was blocked.')
                            return
                        }
                        console.log(err)
                    }
                }
            }
            console.log(err.response.data)
        }
    }
    const plus_18 = total.flat(1).reduce((acc, center) => {
        const tmpCenter = { ...center }
        const sessions = center.sessions.filter(session => (session.min_age_limit == 18) && (session.available_capacity > 0))
        if (sessions.length) {
            tmpCenter.sessions = sessions
            acc.push(tmpCenter)
        }
        return acc
    }, [])
    console.log('Avaialbe Centers 18+ =', plus_18.length)
    const plus_45 = total.flat(1).reduce((acc, center) => { 
        const tmpCenter = { ...center }
        const sessions = center.sessions.filter(session => (session.min_age_limit == 45) && (session.available_capacity > 0))
        if (sessions.length) {
            tmpCenter.session = sessions
            acc.push(tmpCenter)
        }
        return acc
    }, [])
    console.log('Available Centers 45+ =', plus_45.length)
    // message all users
    for (const user of users) {
        try {
            let isUserSnoozed = false
            let informedUser = false
            if (user.snoozeTime && user.snoozeTime > parseInt(Date.now() / 1000)) {
                console.log('User is snoozed!')
                isUserSnoozed = true
                continue
            } 
            const found18s = plus_18.filter(center => (center.pincode == user.pincode) && (center.sessions.filter(session => session.min_age_limit == user.age_group)))
            if (found18s.length) {
                for (const found18 of found18s) {
                    const txt = `✅<b>SLOT AVAILABLE!</b>\n\n<b>Name</b>: ${found18.name}\n<b>Pincode</b>: ${found18.pincode}\n<b>Age group</b>: 18+\n<b>Slots</b>:\n\t${found18.sessions.map(s => `<b>Date</b>: ${s.date}\n\t<b>Available Slots</b>: ${s.available_capacity}`).join('\n')}\n\n<u>Hurry! Book your slot before someone else does.</u>`
                    await bot.telegram.sendMessage(user.chatId, txt, { parse_mode: 'HTML' })
                    const currentTime = parseInt(Date.now()/1000)
                    Users.find({ chatId: user.chatId }).assign({ lastAlert: currentTime })
                }
                informedUser = true
            }
            const found45s = plus_45.filter(center => (center.pincode == user.pincode) && (center.sessions.filter(session => session.min_age_limit == user.age_group)))
            if (found45s.length) {
                for (const found45 of found45s) {
                    const txt = `✅<b>SLOT AVAILABLE!</b>\n\n<b>Name</b>: ${found45.name}\n<b>Pincode</b>: ${found45.pincode}\n<b>Age group</b>: 45+\n<b>Slots</b>:\n\t${found45.sessions.map(s => `<b>Date</b>: ${s.date}\n\t<b>Available Slots</b>: ${s.available_capacity}`).join('\n')}\n\n<u>Hurry! Book your slot before someone else does.</u>`
                    await bot.telegram.sendMessage(user.chatId, txt, { parse_mode: 'HTML' })
                    const currentTime = parseInt(Date.now()/1000)
                    Users.find({ chatId: user.chatId }).assign({ lastAlert: currentTime })
                }
                informedUser = true
            }
            if (user.pincode && !isUserSnoozed && informedUser) {
                await bot.telegram.sendMessage(user.chatId, 'Stop alerts? Have you booked the date?\nOr you can also /snooze the messages for a while :)', { reply_markup: {
                    inline_keyboard: [
                        [ { text: 'Yes 👍', callback_data: 'yes_booked' }, { text: 'No 👎', callback_data: 'not_booked' } ]
                    ]
                } })
            }
        } catch (err) {
            console.log('ERROR WHILE INFORMING!')
            console.log(err)
        }
    }
}

bot.action('yes_booked', async (ctx) => {
    Users.find({ chatId: ctx.update.callback_query.from.id }).assign({ pincode: null }).assign({ age_group: null }).write()
    return await ctx.editMessageText('Congratulations! Thanks for using the bot. Follow me on <a href="https://fb.me/swapnilsoni1999">Facebook</a> if you want to. :)\nPlease note that you\'re now untracked. If you want to track for another dose then /track again.', { parse_mode: 'HTML' })
})

bot.action('not_booked', async (ctx) => {
    const user = Users.find({ chatId: ctx.chat.id }).value()
    return await ctx.editMessageText(`No worries! You\'re still tracked for <b>${user.pincode}</b> and age group of <b>${user.age_group}+</b>\nWish you luck for the next time. :)`, { parse_mode: 'HTML' })
})

setInterval(trackAndInform, 80 * 1000)
bot.launch()
