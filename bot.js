const { Telegraf, Scenes, session, TelegramError } = require('telegraf')
const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const CoWIN = require('./wrapper')
const { nanoid }  = require('nanoid')

const BOT_TOKEN = '1707560756:AAGklCxSVVtfEtPBYEmOCZW6of4nEzffhx0'
const bot = new Telegraf(BOT_TOKEN)
const INVITE_KEY = "C0WiNbotSwapnil"
const SWAPNIL = 317890515

const adapter = new FileSync('db.json')
const db = low(adapter)
db.defaults({ users: [] }).write()

const Users = db.get('users')

/**
 * Helper methods
 */
const MAX_TRACKING_ALLOWED = 4
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

const THUMBS = {
    up: ['👍', '👍🏻', '👍🏼', '👍🏽', '👍🏾', '👍🏿'],
    down: ['👎', '👎🏻', '👎🏼', '👎🏽', '👎🏾', '👎🏿']
}

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

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(), ms)
    })
}


/**
 * Middlewares
 */

const authMiddle = async (ctx, next) => {
    if (_isAuth(ctx.chat.id)) {
        next()
    } else {
        try {
            return await ctx.reply('Sorry! You\'re not logged in! Please /login first.')
        } catch (err) {
            if (err instanceof TelegramError) {
                Users.remove({ chatId: ctx.chat.id }).write()
            }
        }
    }
}

const inviteMiddle = async (ctx, next) => {
    if(_isInvited(ctx.chat.id)) {
        next()
    } else {
        try {
            return await ctx.reply('Please verify yourself by providing invite code!\nSend /start to invite yourself.')
        } catch (err) {
            if (err instanceof TelegramError) {
                Users.remove({ chatId: ctx.chat.id }).write()
            }
        }
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

const botUnderMaintain = async (ctx, next) => {
    if (ctx.chat.id == SWAPNIL) {
        return next()
    }
    try {
        return await ctx.reply('Bot is under maintenance. Reason: The server\'s IP got banned on cowin api. So you have to wait until I find some indian proxies. If you can help then dm @SoniSins')
    } catch (err) { }
}

/**
 * Wizards
 */

const inviteWizard = new Scenes.WizardScene(
    'invite',
    async (ctx) => {
        try {
            await ctx.reply('Send invitation code to access this bot!')
            return ctx.wizard.next()
        } catch (error) {
            if (error instanceof TelegramError) {
                Users.remove({ chatId: ctx.chat.id }).write()
                return
            }    
            console.log(error)
            try {
                await ctx.reply('Some error occured please retry again with /start!')
            } catch (err) { 
                Users.remove({ chatId: ctx.chat.id }).write()
            }
            return ctx.scene.leave()
        }
    },
    async (ctx) => {
        try {
            const code = ctx.message.text
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
            if (error instanceof TelegramError) {
                Users.remove({ chatId: ctx.chat.id }).write()
                return ctx.scene.leave()
            }
            console.log(error)
            try {
                await ctx.reply('Some error occured please retry again with /start!')
            } catch (err) {
                Users.remove({ chatId: ctx.chat.id }).write()
            }
            return ctx.scene.leave()
        }
    }
)

const loginWizard = new Scenes.WizardScene(
    'login',
    async (ctx) => {
        try {
            await ctx.reply('Send your phone number (10 digits only)')
            return ctx.wizard.next()
        } catch (error) {
            if (error instanceof TelegramError) {
                Users.remove({ chatId: ctx.chat.id }).write()
                return ctx.scene.leave()
            }
            console.log(error)
            try {
                await ctx.reply('Some error occured please retry!')
            } catch (err) { }
            return ctx.scene.leave()
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
                if (err instanceof TelegramError) {
                    Users.remove({ chatId: ctx.chat.id }).write()
                    return ctx.scene.leave()
                }
                console.log(err)
                await ctx.reply('Error while sending otp!\nPlease try again!')
                return ctx.scene.leave()
            }
            
            await ctx.reply('Enter your otp')
            return ctx.wizard.next()
        } catch (error) {
            if (error instanceof TelegramError) {
                Users.remove({ chatId: ctx.chat.id }).write()
                return ctx.scene.leave()
            }
            console.log(error)
            try {
                await ctx.reply('Some error occured please retry!')
            } catch (err) {}
            return ctx.scene.leave()
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
                if (err instanceof TelegramError) {
                    Users.remove({ chatId: ctx.chat.id }).write()
                    return ctx.scene.leave()
                }
                console.log(err)
                await ctx.reply('Invalid otp!\nYou can try again with /otp <your-otp>')
                return ctx.scene.leave()
            }
        } catch (error) {
            if (error instanceof TelegramError) {
                Users.remove({ chatId: ctx.chat.id }).write()
                return ctx.scene.leave()
            }
            console.log(error)
            try {
                await ctx.reply('Some error occured please retry!')
            } catch (err) { }
            return ctx.scene.leave()
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
            await ctx.reply('Send your pincode')  
            return ctx.wizard.next()
        } catch (error) {
            console.log(error)
            try {
                await ctx.reply('Some error occured please retry!')
            } catch (err) { }
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
            Users.find({ chatId: ctx.chat.id }).assign({ tmpPincode: pincode }).write()
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
            try {
                await ctx.reply('Some error occured please retry!')
            } catch (err) { }
            return ctx.scene.leave()
        }
    },
    async (ctx) => {
        try {
            const { tmpPincode } = Users.find({ chatId: ctx.chat.id }).pick('tmpPincode').value()
            ctx.wizard.state.pincode = tmpPincode
            const { tmp_age_group } = Users.find({ chatId: ctx.chat.id }).pick('tmp_age_group').value()
            ctx.wizard.state.age_group = tmp_age_group
            if (!tmp_age_group || !tmpPincode) {
                await ctx.reply('Please select valid age group and provide valid pincode and try again.')
                return ctx.scene.leave()
            }
            const userTracking = Users.find({ chatId: ctx.chat.id }).get('tracking').find({ pincode: tmpPincode, age_group: tmp_age_group }).value()
            if (userTracking) {
                await ctx.reply('You are already tracking this pincode and age group!')
                return ctx.scene.leave()
            }
            await ctx.reply(`Your provided Information.\n<b>Pincode</b>: ${ctx.wizard.state.pincode}\n<b>Age group</b>: ${ctx.wizard.state.age_group}+\nIf it is correct then send 👍 else 👎`, { parse_mode: 'HTML' })
            return ctx.wizard.next()
        } catch (err) {
            console.log(err)
            try {
                await ctx.reply('Some error occured please retry!')
            } catch (err) { }
            return ctx.scene.leave()
        }
    },
    async (ctx) => {
        try {
            const confirmed = ctx.message.text
            if (THUMBS.up.includes(confirmed)) {
                await ctx.reply('Request accepted!')
                Users.find({ chatId: ctx.chat.id }).get('tracking').push({ id: nanoid(), pincode: ctx.wizard.state.pincode, age_group: ctx.wizard.state.age_group }).write()
                Users.find({ chatId: ctx.chat.id }).unset('tmpPincode').write()
                Users.find({ chatId: ctx.chat.id }).unset('tmp_age_group').write()
                await ctx.reply('Now, You\'ll be notified as soon as the vaccine will be available in your desired pincode. Please take a note that this bot is in experimental mode. You may or may not receive messages. So please check the portal by yourself as well. Also if you find some issues then please let me know @SoniSins')
                await ctx.reply(`You can track multiple pins. Max tracking pin limit is ${MAX_TRACKING_ALLOWED}`)
                return ctx.scene.leave()
            } else {
                await ctx.reply('Request declined!')
                Users.find({ chatId: ctx.chat.id }).unset('tmpPincode').unset('tmp_age_group').write()
                return ctx.scene.leave()
            }
        } catch (error) {
            console.log(error)
            try {
                await ctx.reply('Some error occured please retry!')
            } catch (err) { }
            return ctx.scene.leave()
        }
    }
)

slotWizard.command('cancel', async (ctx) => {
    await ctx.scene.leave()
    return await ctx.reply('Operation cancelled!')
})

bot.action('18_plus', async (ctx) => {
    const chatId = ctx.update.callback_query.from.id
    Users.find({ chatId }).assign({ tmp_age_group: 18 }).write()
    return await ctx.editMessageText('Selected 18+ age group.\nSend any text to continue...')
    // return ctx.scene.enter('track-pt2')
})

bot.action('45_plus', async (ctx) => {
    const chatId = ctx.update.callback_query.from.id
    Users.find({ chatId }).assign({ tmp_age_group: 45 }).write()
    return await ctx.editMessageText('Selected 45+ age group.\nSend any text to continue...')
    // return ctx.scene.enter('track-pt2')
})

const sendToAll = new Scenes.WizardScene(
    'send-all',
    async (ctx) => {
        await ctx.reply('Send the message which you want to convey to all.')
        return ctx.wizard.next()
    },
    async (ctx) => {
        const msg = ctx.message.text
        const entities = ctx.message.entities
        const users = (Users.value()).filter(u => u.allowed && u.chatId)
        await ctx.reply(`Broadcasting the message to ${users.length} people.`)
        const mesg = await ctx.reply('Status...')
        
        await ctx.scene.leave()
        let counter = 1
        for (const user of users) {
            try {
                if (user.allowed) {
                    await bot.telegram.sendMessage(user.chatId, msg, { entities })
                    await sleep(200)
                }
            } catch (err) {
                console.log("Broadcast error!", err)
                if (err instanceof TelegramError) {
                    if (err.response.error_code == 403) {
                        Users.remove({ chatId: user.chatId }).write()
                    }
                }
            }
            await ctx.telegram.editMessageText(SWAPNIL, mesg.message_id, null, `Notified to ${counter}/${users.length} people.`)
            counter += 1
        }
    }
)

sendToAll.command('cancel', async (ctx) => {
    await ctx.scene.leave()
    return await ctx.reply('Operation cancelled!')
})

const stage = new Scenes.Stage([loginWizard, slotWizard, inviteWizard, sendToAll])

// bot.use(botUnderMaintain)
bot.use(session())
bot.use(groupDetection)
bot.use(stage.middleware())

/**
 * Commands
 */

bot.help(inviteMiddle, async (ctx) => {
    try {
        let commands = ``
        if (_isAuth(ctx.chat.id)) {
            commands += `/beneficiaries = to list beneficiaries\n/logout = logout from the bot/portal\n`
        }
        commands += `/snooze = To pause messages for several given time\n/unsnooze = remove message pause and get message on every ~1min interval\n/login = To login with your number!\n/track = to track available slot with given pincode.\n/untrack = untrack your current pincode\n/otp <your-otp> = during auth if your otp is wrong then you can try again with /otp command\n/status = check your status`
        return await ctx.reply(commands)
    } catch (err) {
        if (err instanceof TelegramError) {
            Users.remove({ chatId: ctx.chat.id }).write()
            return
        }
    }
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
    try {
        const user = Users.find({ chatId: ctx.chat.id }).value()
        if (!user.token) {
            return await ctx.reply('You\'re not logged in! Please /login first.')
        }
        if (user.txnId) {
            Users.find({ chatId: ctx.chat.id }).assign({ txnId: null }).write()
        }
        Users.find({ chatId: ctx.chat.id }).assign({ token: null, txnId: null }).write()
        return await ctx.reply('Logged out! Send /login to login. Note: You\'re still tracking your current pincode and age group. Check it with /status')
    } catch (err) {
        if (err.response.status == 403 || err instanceof TelegramError) {
            Users.remove({ chatId: ctx.chat.id }).write()
        }
    }
})

function expandAppointments(appointments) {
    // seperated by \n at end \t at begining
    const appintmentMap = appointments.map(ap => `There ${appointments.length > 1 ? 'are': 'is'} ${appointments.length} appointment${appointments.length>1? 's': ''} Booked.\n\t<b>Center Name</b>: ${ap.name}\n\t<b>District</b>: ${ap.district}\n\t<b>Block</b>: ${ap.block_name}\n\t<b>Center Timings</b>:\n\t\t<u><b>From</b></u>: ${ap.from}\n\t\t<u><b>To</b></u>: ${ap.to}\n\t<b>Dose</b>: ${ap.dose}\n\t<b>Date</b>: ${ap.date}\n\t<u><b>Your time Slot</b></u>: <u>${ap.slot}</u>`)
    return appintmentMap.join("\n")
}


bot.command('beneficiaries', inviteMiddle, authMiddle, async (ctx) => {
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
        if(err instanceof TelegramError && err.response.status == 401) {
            Users.find({ chatId: ctx.chat.id }).assign({ token: null }).assign({ txnId: null }).write()
            return await ctx.reply('Token expired! Please /login again.')
        }
        return await ctx.reply('Something went wrong please try again later!')
    }
})

bot.command('track', inviteMiddle, authMiddle, async (ctx) => {
    try {
        const { tracking } = Users.find({ chatId: ctx.chat.id }).pick('tracking').value()
        if (!tracking) {
            Users.find({ chatId: ctx.chat.id }).assign({ tracking: [] }).write()
        }
        if (Array.isArray(tracking) && tracking.length >= MAX_TRACKING_ALLOWED) {
            return await ctx.reply(`Sorry you can track maximum ${MAX_TRACKING_ALLOWED} pincodes. send /untrack to remove one of the pincode.`)
        }
        return ctx.scene.enter('slot-booking')
    } catch (err) {
        console.log(err)
        await bot.telegram.sendMessage(SWAPNIL, 'Err occured for user ' + ctx.chat.id)
        return await ctx.reply('Something went wrong please try again later!')
    }
})

bot.command('untrack', inviteMiddle, async (ctx) => {
    try {
        const { tracking } = Users.find({ chatId: ctx.chat.id }).pick('tracking').value()
        if (!tracking.length) {
            return await ctx.reply('You aren\'t tracking any pincode. send /track to start tracking.')
        }
        const markupButton = []
        for (let i=0; i<tracking.length; i++) {
            const { id, pincode, age_group } = tracking[i]
            markupButton.push([{ text: `Pin: ${pincode} | Age: ${age_group}`, callback_data: `remove-pin--${id}` }])
        }
        return await ctx.reply('Choose which pincode to remove.', { reply_markup: { inline_keyboard: markupButton } })
    } catch (error) {
        if (error instanceof TelegramError) {
            Users.remove({ chatId: ctx.chat.id }).write()
            return
        }
        console.log(error)
        return await ctx.reply('Something went wrong please try again later!')
    }
})
bot.action(/remove-pin--.*/, async (ctx) => {
    try {
        const trackingId = ctx.update.callback_query.data.split('remove-pin--')[1]
        console.log(Users.find({ chatId: ctx.update.callback_query.from.id }).get('tracking').find({ id: trackingId }).value())
        const { pincode, age_group } = Users.find({ chatId: ctx.update.callback_query.from.id }).get('tracking').find({ id: trackingId }).value()
        Users.find({ chatId: ctx.update.callback_query.from.id }).get('tracking').remove({ id: trackingId }).write()
        return await ctx.editMessageText(`Removed ${pincode}|${age_group} from your tracking list.`)
    } catch (err) {
        console.log(err)
        await ctx.reply('Some error occured!')
    }
})

bot.command('snooze', inviteMiddle, async (ctx) => {
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

bot.command('unsnooze', inviteMiddle, async (ctx) => {
    Users.find({ chatId: ctx.chat.id }).assign({ snoozeTime: null }).write()
    return await ctx.reply('Unsoozed! You can /snooze your messages if they\'re annoying.')
})

function expandTracking(tracking) {
    return tracking.map(t => `\t<b>Pincode</b>: ${t.pincode} | <b>Age Group</b>: ${t.age_group}`).join('\n')
}

bot.command('status', inviteMiddle, async (ctx) => {
    try {
        const user = Users.find({ chatId: ctx.chat.id }).value()
        const txt = `<b>ChatId</b>: ${user.chatId}\n<b>SnoozeTime</b>: ${secondsToHms(user.snoozeTime - user.snoozedAt) || 'Not snoozed'}\n<b>Tracking Pincode</b>: ${Array.isArray(user.tracking) && user.tracking.length ? '\n' + expandTracking(user.tracking) : 'No pincode'}\n<b>Logged in?</b>: ${user.token ? 'Yes' : 'No'}\n\nType /help for more info.`
        return await ctx.reply(txt, { parse_mode: 'HTML' })
    } catch (err) {
        console.log(err)
    }
})

bot.command('revokeall', async (ctx) => {
    if (ctx.chat.id == SWAPNIL) {
        await ctx.reply('Revoking everyone\'s token!')
        const users = (Users.value()).filter(u => u.allowed && u.token && !!u.chatId && Array.isArray(u.tracking) && u.tracking.length)
        for (const user of users) {
            if (user.chatId) {
                Users.find({ chatId: user.chatId }).assign({ token: null }).write()
            }
        }
        return await ctx.reply(`Revoked ${users.length} user\'s token!`)
    }
})

bot.action(/snooze_req--\d+/, async (ctx) => {
    const seconds = ctx.update.callback_query.data.split('snooze_req--')[1]
    const lit = SNOOZE_LITERALS.find(v => v.seconds === parseInt(seconds))
    await ctx.editMessageText(`You've snoozed bot messages for ${lit.name}\nYou can unsnooze using /unsnooze`)
    const currentTime = parseInt(Date.now()/1000)
    Users.find({ chatId: ctx.update.callback_query.from.id }).assign({ snoozeTime: currentTime + lit.seconds, snoozedAt: currentTime }).write()
})

async function trackAndInform() {
    console.log('Fetching information')
    const users = Users.value()
    for (const user of users) {
        try {
            let informedUser = false
            if (!user.allowed) {
                continue
            }
            if (user.snoozeTime && user.snoozeTime > parseInt(Date.now() / 1000)) {
                console.log('User is snoozed!')
                // skip the user
                continue
            }
            if (!user.token && (Array.isArray(user.tracking) && user.tracking.length)) {
                console.log('No token!')
                try {
                    await bot.telegram.sendMessage(user.chatId, 'Please /login your token has been expired or you haven\'t logged in yet.')
                } catch (err) {}
                continue
            }
            if (!Array.isArray(user.tracking) || !user.tracking.length) {
                console.log('No pincode!')
                continue
            }
            if (user.snoozeTime && user.snoozeTime < parseInt(Date.now() / 1000)) {
                console.log('Snooze timeout for user!')
                Users.find({ chatId: user.chatId }).assign({ snoozeTime: null }).write()
                await bot.telegram.sendMessage(user.chatId, 'You\'re now unsnoozed.')
            }
            for (const trc of user.tracking) {
                const userdata = { pincode: trc.pincode, age_group: trc.age_group, trackingId: trc.id }
                const centers = await CoWIN.getCenters(userdata.pincode, user.token)
                await sleep(1200)
                console.log("PIN:", userdata.pincode, "Centers:", centers.length)
                
                const available = centers.reduce((acc, center) => {
                    const tmpCenter = { ...center }
                    const sessions = center.sessions.filter(session => (session.available_capacity > 0))
                    if (sessions.length) {
                        tmpCenter.sessions = sessions
                        acc.push(tmpCenter)
                    }
                    return acc
                }, [])

                const userCenters = available.filter(center => 
                    (center.pincode == userdata.pincode) && 
                    (center.sessions.filter(session => session.min_age_limit == userdata.age_group).length)
                )

                for (const uCenter of userCenters) {
                    const txt = `✅<b>SLOT AVAILABLE!</b>\n\n<b>Name</b>: ${uCenter.name}\n<b>Pincode</b>: ${uCenter.pincode}\n<b>Age group</b>: ${userdata.age_group}+\n<b>Slots</b>:\n\t${uCenter.sessions.map(s => `<b>Date</b>: ${s.date}\n\t<b>Available Slots</b>: ${s.available_capacity}${s.vaccine ? '\n\t<b>Vaccine</b>: ' + s.vaccine : ''}`).join('\n')}\n\n<u>Hurry! Book your slot before someone else does.</u>`
                    try {
                        await bot.telegram.sendMessage(user.chatId, txt, { parse_mode: 'HTML' })
                        console.log('Informed user!')
                        informedUser = true
                    } catch (err) {
                        if (err instanceof TelegramError) {
                            Users.remove({ chatId: user.chatId }).write()
                            console.log('Removed chatId because bot was blocked.')
                        } else {
                            console.log(err)
                        }
                    }
                }
                try {
                    if (informedUser) {
                        await bot.telegram.sendMessage(user.chatId, 'Stop alerts? Have you booked the date?\nOr you can also /snooze the messages for a while :)', { reply_markup: {
                            inline_keyboard: [
                                [ { text: 'Yes 👍', callback_data: `yes_booked` }, { text: 'No 👎', callback_data: 'not_booked' } ]
                            ]
                        } })
                    }
                } catch (err) {
                    if (err instanceof TelegramError) {
                        Users.remove({ chatId: user.chatId }).write()
                        return
                    } else {
                        console.log(err)
                    }
                }
            }
            
        } catch (err) {
            console.log('Something wrong!', err)
        }
    }
    // await sleep(10*1000)
}

bot.command('sendall', async (ctx) => {
    if (ctx.chat.id == SWAPNIL) {
        ctx.scene.enter('send-all')
    } else {
        return await ctx.reply('Sorry this command is for admin only!')
    }
})

bot.command('botstat', async (ctx) => {
    if (ctx.chat.id == SWAPNIL) {
        const users = Users.value()
        const txt = `Bot Stat!\n<b>Total Users</b>: ${users.length}\n<b>Verified Users (InviteKey)</b>: ${users.filter(u => u.allowed).length}\n<b>Unverified Users</b>: ${users.filter(u => !u.allowed).length}\n<b>Total pincodes in tracking</b>: ${users.filter(v => v.tracking).flat(1).length}\n<b>Logged in users</b>: ${users.filter(u => u.token).length}`
        return await ctx.reply(txt, { parse_mode: 'HTML' })
    }
})

bot.command('sync', async (ctx) => {
    if (ctx.chat.id == SWAPNIL) {
        try {
            const withToken = (ctx.message.text.split(' ')[1].toLowerCase() === 'yes' ? true : false)
            await ctx.reply(`Updating the handler with${withToken ? '' : 'out'} token...`)
            const totalPincodes = getTotalPincodes(withToken)
            clearInterval(trackerHandle)
            trackerHandle = setInterval(trackAndInform, totalPincodes * 1000)
            await ctx.reply(`Updated handler with ${totalPincodes} pincodes.`)
        } catch (err) {
            console.log(err)
            return await ctx.reply('Please provide /sync <yes|no> for token check.')
        }
    }
})

bot.action('yes_booked', async (ctx) => {
    // Users.find({ chatId: ctx.update.callback_query.from.id }).get('tracking').remove({ id: trackingId }).write()
    return await ctx.editMessageText('Congratulations! Thanks for using the bot. Follow me on <a href="https://fb.me/swapnilsoni1999">Facebook</a> if you want to. :)\nYou can /untrack your desired pin if you wish to. If you want to track for another dose then /track to add new pin.\n You can also check your tracking stats using /status', { parse_mode: 'HTML' })
})

bot.action('not_booked', async (ctx) => {
    const user = Users.find({ chatId: ctx.chat.id }).value()
    return await ctx.editMessageText(`No worries! You\'re still tracked for your current pincodes and age groups!.\nYou can check stat by /status\nWish you luck for the next time. :)`, { parse_mode: 'HTML' })
})

function getTotalPincodes (withToken) {
    const totalPincodes = (Users.value()).reduce((acc, val) => {
        if (Array.isArray(val.tracking) && val.tracking.length) {
            if (withToken ? !!val.token : true) {
                acc += val.tracking.length
            }
        }
        return acc
    }, 0)
    return totalPincodes
}
const totalPincodes = getTotalPincodes(false)
console.log('Setting interval timeout for', totalPincodes , 'seconds!')
var trackerHandle = setInterval(trackAndInform, totalPincodes * 1000)
trackAndInform()
bot.launch()
