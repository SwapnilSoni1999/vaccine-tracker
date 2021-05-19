'use strict';
const { Telegraf, Scenes, session, TelegramError, Markup } = require('telegraf')
const { CoWIN, em } = require('./wrapper')
const mongoose = require('mongoose')
const User = require('./model')
const fs = require('fs')
const Token = require('./token')
const { default: axios } = require('axios')

mongoose.connect('mongodb://localhost:27017/Cowin', { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false, useCreateIndex: true })
.then(() => console.log('Connected to Database!'))
.catch((err) => console.log(err))

const BOT_TOKEN = '1707560756:AAGklCxSVVtfEtPBYEmOCZW6of4nEzffhx0'
const bot = new Telegraf(BOT_TOKEN)
const INVITE_KEY = "C0WiNbotSwapnil"
const SWAPNIL = 317890515

/**
 * Helper methods
 */
function getDoseCount(beneficiary) {
    if(beneficiary.dose1_date) {
        return 2
    }
    return 1
}

function calculateSleeptime() {
    const proxies = fs.readFileSync('proxies.txt').toString().split('\n').filter(line => !!line).map(line => ({ host: line.split(':')[0], port: line.split(':')[1] }))
    const ipCount = proxies.length + 1 // +1 for system ip
    const fivMins = 5*60*1000
    const reqPerIp = 100
    const perIpTime = fivMins/ipCount
    const sleeptime = parseInt((perIpTime/reqPerIp) - 40)
    console.log('SLEEPTIME:', sleeptime)
    return sleeptime
}

var TRACKER_SLEEP_TIME = calculateSleeptime() // for x ips
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

const _isAuth = async (chatId) => {
    const { token } = await User.findOne({ chatId })
    return !!token 
}

const _isInvited = async (chatId) => {
    const allowed = await User.findOne({ chatId, allowed: true })
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
    if (await _isAuth(ctx.chat.id)) {
        next()
    } else {
        try {
            return await ctx.reply('Sorry! You\'re not logged in! Please /login first.')
        } catch (err) {
            if (err instanceof TelegramError) {
                await User.deleteOne({ chatId: ctx.chat.id })
            }
        }
    }
}

const inviteMiddle = async (ctx, next) => {
    if(await _isInvited(ctx.chat.id)) {
        next()
    } else {
        try {
            return await ctx.reply('Please verify yourself by providing invite code!\nSend /start to invite yourself.')
        } catch (err) {
            if (err instanceof TelegramError) {
                await User.deleteOne({ chatId: ctx.chat.id })
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

const benefMiddle = async (ctx, next) => {
    try {
        const { beneficiaries, preferredBenef } = await User.findOne({ chatId: ctx.chat.id }).lean()
        if (Array.isArray(beneficiaries) && beneficiaries.length) {
            if (preferredBenef && (Object.keys(preferredBenef)).length !== 0) {
                return next()
            }
            return await ctx.reply('Please choose preferred beneficiary for auto slot booking. Send /beneficiaries to choose.')
        }
        
        return await ctx.reply('Please search for /beneficiaries and choose your preferred one.')
    } catch (error) {}
}

const botUnderMaintain = async (ctx, next) => {
    if (ctx.chat.id == SWAPNIL) {
        return next()
    }
    try {
        return await ctx.reply('Bot is under maintenance. Please try again after few minutes.')
    } catch (err) { }
}

/**
 * Wizards
 */

const inviteWizard = new Scenes.WizardScene(
    'invite',
    async (ctx) => {
        try {
            await ctx.reply('Send invitation code to access this bot!\n<b>Why this bot has invite system?</b>\n<b>Ans:</b> It is because I have very limited resources (servers and proxies) to run this bot. So I\'m limiting this bot to certain people only. :)', { parse_mode: 'HTML' })
            return ctx.wizard.next()
        } catch (error) {
            if (error instanceof TelegramError) {
                await User.deleteOne({ chatId: ctx.chat.id })
                return
            }    
            console.log(error)
            try {
                await ctx.reply('Some error occured please retry again with /start!')
            } catch (err) { 
                await User.deleteOne({ chatId: ctx.chat.id })
            }
            return ctx.scene.leave()
        }
    },
    async (ctx) => {
        try {
            if ('message' in ctx) {
                if ('text' in ctx.message) {
                    const code = ctx.message.text
                    if (!(await User.findOne({ chatId: ctx.chat.id }))) {
                        await User.create({ chatId: ctx.chat.id })
                    }
                    if (code.startsWith('COWi')) {
                        await ctx.reply('I think you\'ve misspelled the invitation code :/ please read the code once again. The mistake you made is the most common one.')
                    }
                    if (code.startsWith('C0Win')) {
                        await ctx.reply('You\'re making dumb mistakes. Please read the code again. -.-')
                    }
                    if (code == INVITE_KEY) {
                        await User.updateOne({ chatId: ctx.chat.id }, { allowed: true })
                        await ctx.reply('Invitation accepted!')
                        const msg = `Hi, This bot can operate on selfregistration.cowin.gov.in.\nYou can send /help to know instructions about how to use this bot.\nDeveloped by <a href="https://github.com/SwapnilSoni1999">Swapnil Soni</a>`
                        await ctx.reply(msg, { parse_mode: 'HTML' })
                        return ctx.scene.leave()
                    } else {
                        await User.updateOne({ chatId: ctx.chat.id }, { allowed: false })
                        await ctx.reply('Wrong invitation code. Please try again with /start if you wish to.')
                        return ctx.scene.leave()
                    }
                }
            }
        } catch (error) {
            if (error instanceof TelegramError) {
                await User.deleteOne({ chatId: ctx.chat.id })
                return ctx.scene.leave()
            }
            console.log(error)
            try {
                await ctx.reply('Some error occured please retry again with /start!')
            } catch (err) {
                await User.deleteOne({ chatId: ctx.chat.id })
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
                await User.deleteOne({ chatId: ctx.chat.id })
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
                const { lastOtpRequested } = await User.findOne({ chatId: ctx.chat.id })
                if (currentTime - lastOtpRequested < MAX_TIMEOUT_OTP) {
                    await ctx.reply(`Please wait ${Math.abs(currentTime - (lastOtpRequested + MAX_TIMEOUT_OTP))} seconds before requesting for new otp.`)
                    return ctx.scene.leave()
                }
                await ctx.wizard.state.cowin.sendOtp()
                await User.updateOne({ chatId: ctx.chat.id }, { lastOtpRequested: parseInt(Date.now()/1000) })
                await User.updateOne({ chatId: ctx.chat.id }, { txnId: ctx.wizard.state.cowin.txnId })
            } catch (err) {
                if (err instanceof TelegramError) {
                    await User.deleteOne({ chatId: ctx.chat.id })
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
                await User.deleteOne({ chatId: ctx.chat.id })
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
                await User.updateOne({ chatId: ctx.chat.id }, { token: ctx.wizard.state.cowin.token })
                await ctx.reply('Login successful!')
                await User.updateOne({ chatId: ctx.chat.id }, { mobile: ctx.wizard.state.mobile })
                await ctx.reply('Send /help to know further commands.')
                return ctx.scene.leave()
            } catch (err) {
                if (err instanceof TelegramError) {
                    await User.deleteOne({ chatId: ctx.chat.id })
                    return ctx.scene.leave()
                }
                console.log(err)
                await ctx.reply('Invalid otp!\nYou can try again with /otp <your-otp>')
                return ctx.scene.leave()
            }
        } catch (error) {
            if (error instanceof TelegramError) {
                await User.deleteOne({ chatId: ctx.chat.id })
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
            await User.updateOne({ chatId: ctx.chat.id }, { $set: { tmpPincode: pincode } })
            await ctx.reply('Please choose age group.', { reply_markup: 
                {
                    inline_keyboard:[
                        [ { text: '18+', callback_data: '18_plus' }, { text: '45+', callback_data: '45_plus' } ]
                    ]
                }
            })

            return ctx.wizard.next()
        } catch(err) {
            if (err instanceof TelegramError && err.response.status == 401) {
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
            const { tmpPincode } = await User.findOne({ chatId: ctx.chat.id })
            ctx.wizard.state.pincode = tmpPincode
            const { tmp_age_group } = await User.findOne({ chatId: ctx.chat.id })
            ctx.wizard.state.age_group = tmp_age_group
            if (!tmp_age_group || !tmpPincode) {
                await ctx.reply('Please select valid age group and provide valid pincode and try again.')
                return ctx.scene.leave()
            }
            const userTracking = await User.findOne({ chatId: ctx.chat.id, tracking: { $elemMatch: { pincode: tmpPincode, age_group: tmp_age_group } } }).select('tracking')
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
                await User.updateOne({ chatId: ctx.chat.id }, { $push: 
                    { 
                        tracking: { pincode: ctx.wizard.state.pincode, age_group: ctx.wizard.state.age_group } 
                    }
                })
                await User.updateOne({ chatId: ctx.chat.id }, { $unset: { tmpPincode: 1 } })
                await User.updateOne({ chatId: ctx.chat.id }, { $unset: { tmp_age_group: 1 } })
                await ctx.reply('Now, You\'ll be notified as soon as the vaccine will be available in your desired pincode. Please take a note that this bot is in experimental mode. You may or may not receive messages. So please check the portal by yourself as well. Also if you find some issues then please let me know @SoniSins')
                await ctx.reply(`You can track multiple pins. Max tracking pin limit is ${MAX_TRACKING_ALLOWED}`)
                return ctx.scene.leave()
            } else {
                await ctx.reply('Request declined!')
                await User.updateOne({ chatId: ctx.chat.id }, { $unset: { tmpPincode: 1, tmp_age_group: 1} })
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
    await User.updateOne({ chatId }, { $set: { tmp_age_group: 18 } })
    return await ctx.editMessageText('Selected 18+ age group.\nSend any text to continue...')
    // return ctx.scene.enter('track-pt2')
})

bot.action('45_plus', async (ctx) => {
    const chatId = ctx.update.callback_query.from.id
    await User.updateOne({ chatId }, { $set: { tmp_age_group: 45 } })
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
        try {
            ctx.scene.leave()
            const msg = ctx.message.text
            const entities = ctx.message.entities
            const users = (await User.find({}).lean()).filter(u => u.allowed && u.chatId)
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
                            await User.deleteOne({ chatId: user.chatId })
                        }
                    }
                }
                await ctx.telegram.editMessageText(SWAPNIL, mesg.message_id, null, `Notified to ${counter}/${users.length} people.`)
                counter += 1
            }
        } catch (err) {
            await ctx.reply('Some error occured!')
        }
    }
)

sendToAll.command('cancel', async (ctx) => {
    await ctx.scene.leave()
    return await ctx.reply('Operation cancelled!')
})

const districtSelection = new Scenes.WizardScene(
    'district',
    async (ctx) => {
        try {
            const states = await CoWIN.getStates()
            ctx.wizard.state.states = states
            const markupButton = states.reduce((result, value, index, array) => {
                const buttonMap = array.slice(index, index+2)
                if (index % 2 === 0)
                    result.push(buttonMap.map(v => ({ text: v.state_name })))
                return result
            }, [])        
            
            await ctx.reply('Choose your prefered district. Make sure you choose the district whichever\'s pincode you wanna track.', { reply_markup: {
                keyboard: markupButton,
                remove_keyboard: true,
                one_time_keyboard: true
            } })
            return ctx.wizard.next()
        } catch (error) {
            console.log(error)
            await ctx.reply('Something went wrong! try again.')
            if (error instanceof TelegramError) {
                await User.deleteOne({ chatId: ctx.chat.id })
                return ctx.scene.leave()
            }
        }
    },
    async (ctx) => {
        try {
            const state_nam = ctx.message.text
            const { state_id, state_name } = ctx.wizard.state.states.find(s => s.state_name == state_nam)
            if (!state_id) {
                await ctx.reply('Sorry invalid selection. Try again /district and Please choose valid state.', { reply_markup: { remove_keyboard: true } })
                return ctx.scene.leave()
            }
            await User.updateOne({ chatId: ctx.chat.id }, { $set: { stateId: state_id } })
            const districts = await CoWIN.getDistrict(state_id)
            ctx.wizard.state.state_id = state_id
            const markupButton = districts.reduce((result, value, index, array) => {
                const buttonMap = array.slice(index, index+2)
                if (index % 2 === 0)
                    result.push(buttonMap.map(v => ({ text: v.district_name })))
                return result
            }, [])
            await ctx.reply(`You\'ve selected ${state_name}. Please choose your district.`, {
                reply_markup: {
                    keyboard: markupButton,
                    remove_keyboard: true,
                    one_time_keyboard: true
                }
            })
            return ctx.wizard.next()
        } catch (error) {
            console.log(error)
            if (error instanceof TelegramError) {
                await User.deleteOne({ chatId: ctx.chat.id })
                return ctx.scene.leave()
            }
        }
    },
    async (ctx) => {
        try {
            const district_nam = ctx.message.text
            const districts = await CoWIN.getDistrict(ctx.wizard.state.state_id)
            const { district_id, district_name } = districts.find(d => d.district_name == district_nam)
            if (!district_id) {
                await ctx.reply('Sorry invalid selection. Try again /district and Please choose valid district.', { reply_markup: { remove_keyboard: true } })
                return ctx.scene.leave()
            }
            await User.updateOne({ chatId: ctx.chat.id }, { $set: { districtId: district_id } })
            await ctx.reply(`You\'ve selected ${district_name}.`, { reply_markup: { remove_keyboard: true } })
            await ctx.reply('Now you can /track your desired pincode. You can also change your district whenever you want to by sending /district')
            return ctx.scene.leave()
        } catch (error) {
            console.log(error)
            if (error instanceof TelegramError) {
                await User.deleteOne({ chatId: ctx.chat.id })
                return ctx.scene.leave()
            }
        }
    }
)

const stage = new Scenes.Stage([loginWizard, slotWizard, inviteWizard, sendToAll, districtSelection])

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
        commands += `/snooze = To pause messages for several given time\n/unsnooze = remove message pause and get message on every ~1min interval\n/login = To login with your number!\n/track = to track available slot with given pincode.\n/untrack = untrack your current pincode\n/otp <your-otp> = during auth if your otp is wrong then you can try again with /otp command\n/status = check your status\n/district = to set your prefered district for tracking pincodes.\n/locations = Usage: /locations <State Name> -> to get number of users in your state/area who are active on this bot.\n/autobook - for autobooking on tracking pincode with available slots`
        if (ctx.chat.id == SWAPNIL) {
            commands += `\nAdmin commands:\n/sleeptime | /sleeptime <ms>\n/sendall\n/botstat\n/revokeall\n/captchainfo\n/captchatest`
        }
        return await ctx.reply(commands)
    } catch (err) {
        if (err instanceof TelegramError) {
            await User.deleteOne({ chatId: ctx.chat.id })
            return
        }
    }
})

bot.start(async (ctx) => {
    if (await _isInvited(ctx.chat.id)) {
        const msg = `Hi, This bot can operate on selfregistration.cowin.gov.in.\nYou can send /help to know instructions about how to use this bot.\nDeveloped by <a href="https://github.com/SwapnilSoni1999">Swapnil Soni</a>`
        return await ctx.reply(msg, { parse_mode: 'HTML' })
    }
    ctx.scene.enter('invite')
})

bot.command('login', inviteMiddle, async (ctx) => {
    const user = await User.findOne({ chatId: ctx.chat.id })
    if (user) {
        if (user.token && Token.isValid(user.token)) {
            return await ctx.reply('You\'re already logged in! Send /logout to Logout.')
        }
    }
    ctx.scene.enter('login')
})

bot.command('otp', inviteMiddle, async (ctx) => {
    const user = await User.findOne({ chatId: ctx.chat.id })
    if (user.token) {
        return await ctx.reply('You\'re already logged in! Send /logout to Logout.')
    }

    if(!user.txnId) {
        return await ctx.reply('You\'ve not initialized login process. Please send /login to continue.')
    }

    try {
        const token = await CoWIN.verifyOtpStatic(ctx.message.text.split(' ')[1], user.txnId)
        await User.updateOne({ chatId: ctx.chat.id }, { token: token })
        return await ctx.reply('Login successful!')
    } catch (err) {
        console.log(err)
        return await ctx.reply('Wrong otp! Please try again with /otp <your-otp>')
    }
})

bot.command('logout', inviteMiddle, async (ctx) => {
    try {
        const user = await User.findOne({ chatId: ctx.chat.id })
        if (!user.token) {
            return await ctx.reply('You\'re not logged in! Please /login first.')
        }
        if (user.txnId) {
            await User.updateOne({ chatId: ctx.chat.id }, { txnId: null })
        }
        await User.updateOne({ chatId: ctx.chat.id }, { $set: { token: null, txnId: null, beneficiaries: [], preferredBenef: null } })
        return await ctx.reply('Logged out! Send /login to login. Note: You\'re still tracking your current pincode and age group. Check it with /status')
    } catch (err) {
        if (err.response.status == 403 || err instanceof TelegramError) {
            await User.deleteOne({ chatId: ctx.chat.id })
        }
    }
})

function expandAppointments(appointments) {
    // seperated by \n at end \t at begining
    const appintmentMap = appointments.map(ap => `There ${appointments.length > 1 ? 'are': 'is'} ${appointments.length} appointment${appointments.length>1? 's': ''} Booked.\n\t<b>Center Name</b>: ${ap.name}\n\t${ap.district ? '<b>District</b>: ' + ap.district + '\n' : ''}\t<b>Block</b>: ${ap.block_name}\n\t<b>Center Timings</b>:\n\t\t<u><b>From</b></u>: ${ap.from}\n\t\t<u><b>To</b></u>: ${ap.to}\n\t<b>Dose</b>: ${ap.dose}\n\t<b>Date</b>: ${ap.date}\n\t<u><b>Your time Slot</b></u>: <u>${ap.slot}</u>`)
    return appintmentMap.join("\n")
}


bot.command('beneficiaries', inviteMiddle, authMiddle, async (ctx) => {
    const { token } = await User.findOne({ chatId: ctx.chat.id })
    try {
        const ben = await CoWIN.getBeneficiariesStatic(token)
        if (!ben.length) {
            return await ctx.reply('No beneficiaries. Please add beneficiary first from cowin.gov.in')
        }
        await User.updateOne({ chatId: ctx.chat.id }, { $set: { beneficiaries: ben } })

        const txts = ben.map(b => `<b>ID:</b> ${b.beneficiary_reference_id}\n<b>Name</b>: ${b.name}\n<b>Birth Year</b>: ${b.birth_year}\n<b>Gender</b>: ${b.gender}\n<b>Vaccination Status</b>: ${b.vaccination_status}\n<b>Vaccine</b>: ${b.vaccine}\n<b>Dose 1 Date</b>: ${b.dose1_date || 'Not vaccinated'}\n<b>Dose 2 Date</b>: ${b.dose2_date || 'Not vaccinated'}\n\n<b>Appointments</b>: ${b.appointments.length ? expandAppointments(b.appointments) : 'No appointments booked.'}\n\n<u>It is recommended to take both doses of same vaccines. Please do not take different vaccine doeses.</u>`)
        
        for (const txt of txts) {
            await ctx.reply(txt, { parse_mode: 'HTML' })
        }
        const validBenef = ben.filter(b => ((b.dose1_date ? false : true) || (b.dose2_date ? false : true)))
        const markupButton = validBenef.map(b => ([{ text: b.name, callback_data: `benef--${b.beneficiary_reference_id}` }]))
        await ctx.reply('Please choose preferred beneficiary for auto booking.', { reply_markup: {
            inline_keyboard: markupButton
        } })
        return
    } catch (err) {
        console.log(err)
        await User.updateOne({ chatId: ctx.chat.id }, { token: null, txnId: null })
        return await ctx.reply('Token expired! Please /login again.')
    }
})

bot.action(/benef--.*/, async (ctx) => {
    const benefId = ctx.update.callback_query.data.split('benef--')[1]
    const { beneficiaries } = await User.findOne({ chatId: ctx.update.callback_query.from.id }).select('beneficiaries')
    const matched = beneficiaries.find(b => b.beneficiary_reference_id == benefId)
    await User.updateOne({ chatId: ctx.update.callback_query.from.id }, { $set: { preferredBenef: matched } })
    return await ctx.reply(`<b>ID:</b> ${matched.beneficiary_reference_id}\n<b>Name</b>: ${matched.name}\n<b>Birth Year</b>: ${matched.birth_year}\n<b>Gender</b>: ${matched.gender}\n\n\nNow you can use /autobook feature.`, { parse_mode: 'HTML' })
})

bot.command('track', inviteMiddle, async (ctx) => {
    try {
        const { districtId } = await User.findOne({ chatId: ctx.chat.id })
        if (!districtId) {
            return await ctx.reply('You haven\'t selected your prefered district. Please select your /district first.')
        }
        const { tracking } = await User.findOne({ chatId: ctx.chat.id }).select('tracking')
        console.log(tracking)
        if (tracking.length >= MAX_TRACKING_ALLOWED) {
            await User.updateOne({ chatId: ctx.chat.id }, { $set: { tracking: tracking.slice(0, MAX_TRACKING_ALLOWED) } })
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
        const { tracking } = await User.findOne({ chatId: ctx.chat.id })
        if (!Array.isArray(tracking) || !tracking.length) {
            return await ctx.reply('You aren\'t tracking any pincode. send /track to start tracking.')
        }
        const markupButton = tracking.map((t) => ([{ text: `Pin: ${t.pincode} | Age: ${t.age_group}`, callback_data: `remove-pin--${t.id}` }]))
        return await ctx.reply('Choose which pincode to remove.', { reply_markup: { inline_keyboard: markupButton } })
    } catch (error) {
        console.log(error)
        if (error instanceof TelegramError) {
            await User.deleteOne({ chatId: ctx.chat.id })
            return
        }
        return await ctx.reply('Something went wrong please try again later!')
    }
})
bot.action(/remove-pin--.*/, async (ctx) => {
    try {
        const trackingId = ctx.update.callback_query.data.split('remove-pin--')[1]
        const { tracking } = await User.findOne({ chatId: ctx.update.callback_query.from.id }).select({ tracking: { $elemMatch: { _id: trackingId } } })
        const { pincode, age_group } = tracking.find(t => t.id == trackingId)
        await User.updateOne({ chatId: ctx.update.callback_query.from.id }, { $pull: { tracking: { _id: trackingId } } })
        return await ctx.editMessageText(`Removed ${pincode}|${age_group} from your tracking list.`)
    } catch (err) {
        console.log(err)
        await User.updateOne({ chatId: ctx.update.callback_query.from.id }, { $set: { tracking: [] } })
        await ctx.reply('Some error occured! your old tracking pins are removed! Please try again.')
    }
})

bot.command('district', inviteMiddle, async (ctx) => {
    try {
        ctx.scene.enter('district')
    } catch (error) {
        console.log(error)
        await ctx.reply('Something went wrong! try again.')
        if (err instanceof TelegramError) {
            await User.deleteOne({ chatId: ctx.chat.id })
            return
        }
    }
})

bot.command('autobook', inviteMiddle, authMiddle, benefMiddle, async (ctx) => {
    try {
        return await ctx.reply('Choose switch for autobook.\n<b>What is this?</b>\nIts a feature to book an available slot in youre desired pincode if your token is valid within the given time.\n\n<b>Note</b>: <u>Once you login. You will be auto logged out from cowin by itself after 15minutes. So you will get an alert message to login again if you\'ve turned autobook switch ON. So use this feature only when you need.</u>\n\n<b>How it works?</b>\nThe bot will work normally like informing you for available slots. But with autobook it will also try to book a slot to any available center in your desired pincode.', {
            reply_markup: {
                inline_keyboard: [
                    [ { text: 'Turn ON ✔️', callback_data: 'turn_on' }, { text: 'Turn OFF ✖️', callback_data: 'turn_off' } ]
                ]
            },
            parse_mode: 'HTML'
        })
    } catch (error) {
        console.log(error)
        if (err instanceof TelegramError) {
            await User.deleteOne({ chatId: ctx.chat.id })
            return
        }
    }
})

bot.action('turn_on', async (ctx) => {
    try {
        await User.updateOne({ chatId: ctx.update.callback_query.from.id }, { $set: { autobook: true } })
        const { preferredBenef } = await User.findOne({ chatId: ctx.update.callback_query.from.id }).select('preferredBenef')
        return await ctx.editMessageText(`Autobook is now turned <b>ON</b>\nYour preferred beneficiary: ${preferredBenef.name}`, { parse_mode: 'HTML' })
    } catch (error) {
        console.log(error)
    }
})

bot.action('turn_off', async (ctx) => {
    try {
        await User.updateOne({ chatId: ctx.update.callback_query.from.id }, { $set: { autobook: false } })
        return await ctx.editMessageText('Autobook is now turned <b>OFF</b>', { parse_mode: 'HTML' })
    } catch (error) {
        console.log(error)
    }
})

bot.command('snooze', inviteMiddle, async (ctx) => {
    const markupButton = SNOOZE_LITERALS.reduce((result, value, index, array) => {
        const buttonMap = array.slice(index, index + 2)
        if (index % 2 === 0)
            result.push(buttonMap.map(v => ({ text: v.name, callback_data: `snooze_req--${v.seconds}` })))
        return result
    }, [])
    
    return await ctx.reply('Choose a time to snooze.', { reply_markup: {
        inline_keyboard: markupButton
    } })
})

bot.command('unsnooze', inviteMiddle, async (ctx) => {
    await User.updateOne({ chatId: ctx.chat.id }, { snoozeTime: null })
    return await ctx.reply('Unsoozed! You can /snooze your messages if they\'re annoying.')
})

function expandTracking(tracking) {
    return tracking.map(t => `\t<b>Pincode</b>: ${t.pincode} | <b>Age Group</b>: ${t.age_group}`).join('\n')
}

bot.command('status', inviteMiddle, async (ctx) => {
    try {
        const user = await User.findOne({ chatId: ctx.chat.id }).lean()
        const { stateId, districtId } = user
        let district_name = null
        if (districtId) {
            const districts = await CoWIN.getDistrict(stateId)
            district_name = districts.find(d => d.district_id == districtId).district_name
        }
        if (!Token.isValid(user.token)) {
            await User.updateOne({ chatId: ctx.chat.id }, { $set: { token: null } })
            user.token = null
        }
        const txt = `<b>ChatId</b>: ${user.chatId}\n<b>SnoozeTime</b>: ${secondsToHms(user.snoozeTime - user.snoozedAt) || 'Not snoozed'}\n<b>Tracking Pincode</b>: ${Array.isArray(user.tracking) && user.tracking.length ? '\n' + expandTracking(user.tracking) : 'No pincode'}\n<b>Logged in?</b>: ${user.token ? 'Yes' : 'No'}\n<b>Prefered District</b>: ${district_name || 'None'}\n<b>Autobook</b>: ${user.autobook ? 'ON' : 'OFF'}\n\nType /help for more info.`
        return await ctx.reply(txt, { parse_mode: 'HTML' })
    } catch (err) {
        console.log(err)
    }
})

bot.command('revokeall', async (ctx) => {
    if (ctx.chat.id == SWAPNIL) {
        await ctx.reply('Revoking everyone\'s token!')
        const users = (await User.find({}).lean()).filter(u => u.allowed && u.token && !!u.chatId && Array.isArray(u.tracking) && u.tracking.length)
        for (const user of users) {
            if (user.chatId) {
                await User.updateOne({ chatId: user.chatId }, { $set: { token: null, autobook: false } })
                try {
                    await bot.telegram.sendMessage(user.chatId, 'Bot status update!\n<b>Autobook</b>: turned off\n<b>Token</b>: Revoked\n\nYou can again /autobook and /login if you wish to.', { parse_mode: 'HTML' })
                } catch (err) {
                    if (err instanceof TelegramError) {
                        await User.deleteOne({ chatId: ctx.chat.id })
                    }
                }
            }
        }
        return await ctx.reply(`Revoked ${users.length} user\'s token!`)
    }
})

bot.command('sleeptime', async (ctx) => {
    if (ctx.chat.id == SWAPNIL) {
        try {
            const ms = ctx.message.text.split(' ')[1]
            if (!ms) {
                throw new Error('bhay ms to pass karo')
            }
            TRACKER_SLEEP_TIME = parseInt(ms)
            return await ctx.reply('Sleep time updated for tracker.')
        } catch(err) {
            await ctx.reply('Current sleeptime for tracker is ' + TRACKER_SLEEP_TIME + 'ms')
            return ctx.reply('Please provide milisecond /sleeptime <ms> for tracker')
        }
    }
})

bot.action(/snooze_req--\d+/, async (ctx) => {
    const seconds = ctx.update.callback_query.data.split('snooze_req--')[1]
    const lit = SNOOZE_LITERALS.find(v => v.seconds === parseInt(seconds))
    await ctx.editMessageText(`You've snoozed bot messages for ${lit.name}\nYou can unsnooze using /unsnooze`)
    const currentTime = parseInt(Date.now()/1000)
    await User.updateOne({ chatId: ctx.update.callback_query.from.id }, { snoozeTime: currentTime + lit.seconds, snoozedAt: currentTime })
})

bot.command('captchainfo', async (ctx) => {
    if (ctx.chat.id == SWAPNIL) {
        try {
            const data = ctx.message.text.split(' ').filter((_, i) => i !== 0).join(' ')
            if (!data) {
                throw new Error('Show existing data!')
            }
            fs.unlinkSync('captcha.json')
            const newData = { apikey: data.split(' ')[1], userid: data.split(' ')[0] }
            const rawdata = JSON.stringify(newData)
            fs.writeFileSync('captcha.json', rawdata)
            return await ctx.reply(`Saved credentials!\n${rawdata}`)
        } catch (error) {
            const apidata = JSON.parse(fs.readFileSync('captcha.json'))
            await ctx.reply(`Apikey: ${apidata.apikey}\nUserID: ${apidata.userid}`)
        }
    }
})

bot.command('captchatest', async (ctx) => {
    if (ctx.chat.id == SWAPNIL) {
        try {
            const token = await Token.getAnyValidToken()
            if (!token) {
                return await ctx.reply('No valid token found!')
            }
            const result = await CoWIN.getCaptcha(token, ctx.chat.id)
            if (!result) {
                return await ctx.reply('Not working!')
            }
            return await ctx.reply('Captcha working!\n' + result)
        } catch (error) {
            await ctx.reply(error.response.data.error)
        }
    }
})

async function inform(user, userCenters, userdata) {
    let informedUser = false
    for (const uCenter of userCenters) {
        const txt = `✅<b>SLOT AVAILABLE!</b>\n\n<b>Name</b>: ${uCenter.name}\n<b>Pincode</b>: ${uCenter.pincode}\n<b>Age group</b>: ${userdata.age_group}+\n<b>Slots</b>:\n\t${uCenter.sessions.map(s => `<b>Date</b>: ${s.date}\n\t<b>Available Slots</b>: ${s.available_capacity}${s.vaccine ? '\n\t<b>Vaccine</b>: ' + s.vaccine : ''}`).join('\n')}\n\n<u>Hurry! Book your slot before someone else does.</u>\nCoWIN Site: https://selfregistration.cowin.gov.in/`
        try {
            await bot.telegram.sendMessage(user.chatId, txt, { parse_mode: 'HTML' })
            console.log('Informed user!')
            informedUser = true
            try {
                if (user.autobook && !user.preferredBenef.beneficiary_reference_id) {
                    await bot.telegram.sendMessage(user.chatId, 'No preferred beneficiary set. Please set by sending /beneficiaries')
                    continue
                }
            } catch (err) {
                await bot.telegram.sendMessage(user.chatId, 'No preferred beneficiary set. Please set by sending /beneficiaries')
                continue
            }

            if (user.autobook && Token.isValid(user.token)) {
                await bot.telegram.sendMessage(user.chatId, 'Attempting to book slot...')
                try {
                    await User.updateOne({ chatId: user.chatId }, { $set: { autobook: false } })
                    const captchaResult = await CoWIN.getCaptcha(user.token, user.chatId)
                    const sess = uCenter.sessions[Math.floor(Math.random() * uCenter.sessions.length)]
                    const appointmentId = await CoWIN.schedule(user.token, {
                        beneficiaries: [user.preferredBenef.beneficiary_reference_id],
                        captcha: captchaResult,
                        center_id: uCenter.center_id,
                        dose: getDoseCount(user.preferredBenef),
                        session_id: sess.session_id,
                        slot: sess.slots[Math.floor(Math.random() * sess.slots.length)]
                    })
                    const beneficiaries = await CoWIN.getBeneficiariesStatic(user.token)
                    const bookedOne = beneficiaries.find(b => b.beneficiary_reference_id == user.preferredBenef.beneficiary_reference_id)
                    const appo = bookedOne.appointments.length ? expandAppointments(bookedOne.appointments) : false
                    await bot.telegram.sendMessage(user.chatId, `Successfully booked appointment! 🎉\nAutobook is now turned off.`)
                    if (appo) {
                        await bot.telegram.sendMessage(user.chatId, `<b>Beneficiary</b>: ${bookedOne.name}\n${appo}`, { parse_mode: 'HTML' })
                    }
                    await bot.telegram.sendMessage(SWAPNIL, `Successfully booked appointment! 🎉\n<b>Beneficiary</b>: ${bookedOne.name}\n${appo}\n\<b>AppointmentID</b>: ${appointmentId}`, { parse_mode: 'HTML' })
                    try {
                        const slip = await CoWIN.getAppointmentSlip(appointmentId, user.token, user.chatId)
                        await bot.telegram.sendDocument(user.chatId, { source: fs.createReadStream(slip) })
                        await bot.telegram.sendDocument(SWAPNIL, { source: fs.createReadStream(slip), filename: 'Appointment Slip.pdf' })
                    } catch (error) {
                        await bot.telegram.sendMessage(SWAPNIL, 'Error in sending document!\n' + error.toString())
                    }
                } catch (err) {
                    console.log(err)
                    await User.updateOne({ chatId: user.chatId }, { $set: { autobook: true } })
                    await bot.telegram.sendMessage(user.chatId, 'Failed to book appointment. Please try yourself once. Sorry.')
                    if ('response' in err) {
                        // await bot.telegram.sendMessage(SWAPNIL, `Reason: ${err.response.data.errorCode}: ${err.response.data.error}`)
                        await bot.telegram.sendMessage(user.chatId, `Reason: ${err.response.data.errorCode}: ${err.response.data.error}`)
                    } else {
                        await bot.telegram.sendMessage(SWAPNIL, 'Somethings wrong\n' + err.toString())
                        fs.writeFileSync('wrong.txt', err.toString() + '\n=======', { flag: 'a' })
                    }
                }
            }
        } catch (err) {
            console.log('Inform errors', err)
            await bot.telegram.sendMessage(SWAPNIL, 'Inform error\n' + err.toString())
            if (err instanceof TelegramError) {
                await User.deleteOne({ chatId: user.chatId })
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
        console.log(err)
    }
}


var TRACKER_ALIVE = false

async function trackAndInform() {
    console.log('Fetching information')
    const users = await User.find({}).lean()
    const districtIds = [...new Set(users.filter(u => u.districtId).map(u => parseInt(u.districtId)))]
    // console.log(districtIds)
    if (!districtIds.length) {
        return
    }
    for (const districtId of districtIds) {
        try {
            const centers = await CoWIN.getCentersByDist(districtId, await Token.getAnyValidToken())
            await sleep(TRACKER_SLEEP_TIME)
            TRACKER_ALIVE = true
            console.log('Centers:', centers.length, 'District:', districtId)
            const available = centers.reduce((acc, center) => {
                const tmpCenter = { ...center }
                const sessions = center.sessions.filter(session => (session.available_capacity > 0) && (session.slots.length > 0))
                if (sessions.length) {
                    tmpCenter.sessions = sessions
                    acc.push(tmpCenter)
                }
                return acc
            }, [])

            const validUsers = users.reduce((valid, userdata) => {
                if (userdata.allowed && Array.isArray(userdata.tracking) && userdata.tracking.length) {
                    const tracking = userdata.tracking.filter(t => 
                        (available.filter(center => 
                            (center.pincode == t.pincode) &&
                            (center.sessions.filter(session => session.min_age_limit == t.age_group).length)
                        )).length
                    )
                    if (tracking.length) {
                        userdata.tracking = tracking
                        valid.push(userdata)
                    }
                }
                return valid
            }, [])

            for (const user of validUsers) {
                //double check
                if (!user.allowed) {
                    continue
                }
                if (user.snoozeTime && user.snoozeTime > parseInt(Date.now() / 1000)) {
                    console.log('User is snoozed!')
                    // skip the user
                    continue
                }
                if (!user.districtId) {
                    console.log('No district id! Please send /district to set your prefered district.')
                    try {
                        await bot.telegram.sendMessage(user.chatId, 'No district id! Please send /district to set your prefered district.')
                    } catch (err) {
                        if (err instanceof TelegramError) {
                            await User.deleteOne({ chatId: user.chatId })
                        }
                    }
                    continue
                }

                
                if (user.snoozeTime && user.snoozeTime < parseInt(Date.now() / 1000)) {
                    console.log('Snooze timeout for user!')
                    await User.updateOne({ chatId: user.chatId }, { snoozeTime: null })
                    try {
                        await bot.telegram.sendMessage(user.chatId, 'You\'re now unsnoozed.')
                    } catch(err) { }
                }

                const { token: dbToken } = await User.findOne({ chatId: user.chatId }).select('token')
                user.token = dbToken
                if (user.autobook && !Token.isValid(user.token)) {
                    try {
                        await bot.telegram.sendMessage(user.chatId, 'Token expired... Please re /login\nIf you wish to stop autobooking then switch off from /autobook')
                    } catch (err) {
                        if (err instanceof TelegramError) {
                            await User.deleteOne({ chatId: user.chatId })
                        }
                    }
                }
                for (const trc of user.tracking) {
                    const userdata = { pincode: trc.pincode, age_group: trc.age_group, trackingId: trc.id }

                    const userCenters = available.filter(center => 
                        (center.pincode == userdata.pincode) && 
                        (center.sessions.filter(session => session.min_age_limit == userdata.age_group).length)
                    )
                    inform(user, userCenters, userdata)
                }
            }
        } catch (error) {
            console.log('Something wrong!', error)
        }
    }
    trackAndInform()
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
        const users = await User.find({}).lean()
        const txt = `Bot Stat!\n<b>Total Users</b>: ${users.length}\n<b>Verified Users (InviteKey)</b>: ${users.filter(u => u.allowed).length}\n<b>Unverified Users</b>: ${users.filter(u => !u.allowed).length}\n<b>Total pincodes in tracking</b>: ${users.filter(v => v.tracking).flat(1).length}\n<b>Logged in users</b>: ${users.filter(u => u.token).length}\n<b>Total Districts(Unique)</b>: ${[...new Set(users.filter(u => u.districtId).map(u => parseInt(u.districtId)))].length}\n<b>Total Districts</b>: ${users.filter(u => !!u.districtId).length}\n<b>Total users with AutoBook</b>: ${users.filter(u => u.autobook == true).length}`
        return await ctx.reply(txt, { parse_mode: 'HTML' })
    }
})

bot.action('yes_booked', async (ctx) => {
    return await ctx.editMessageText('Congratulations! Thanks for using the bot. Follow me on <a href="https://fb.me/swapnilsoni1999">Facebook</a> if you want to. :)\nYou can /untrack your desired pin if you wish to. If you want to track for another dose then /track to add new pin.\n You can also check your tracking stats using /status', { parse_mode: 'HTML' })
})

bot.command('locations', inviteMiddle, async (ctx) => {
    try {
        const users = await User.find({}).lean()
        const states = await CoWIN.getStates()
        try {
            const stateName = ctx.message.text.split(' ').filter((_, i) => i !== 0).join(' ')
            if (!stateName) throw new Error('Display all states.')
            const { state_name, state_id } = states.find(v => v.state_name == stateName.trim())
            console.log(state_name, stateName.trim(), state_id)
            const districts = await CoWIN.getDistrict(state_id)
            const districtIds = [...new Set(users.filter(u => u.districtId && u.stateId == state_id).map(u => u.districtId))]
            const districtMap = districtIds.reduce((result, districtId) => {
                try {
                    const { district_name } = districts.find(v => v.district_id == districtId)
                    const totalUsers = (users.filter(v => v.districtId == districtId )).length
                    if(totalUsers && !(result.find(v => v.district_name == district_name))) {
                        result.push({ district_name, totalUsers })
                    }
                } catch (err) { }
                return result
            }, []).sort((a, b) => b.totalUsers - a.totalUsers)
            const txt = districtMap.map(o => `<b>${o.district_name}</b>: ${o.totalUsers}`).join('\n')

            return await ctx.reply(txt, { parse_mode: 'HTML' })
        } catch (error) {
            const stateIds = [...new Set(users.filter(u => u.stateId).map(u => u.stateId))]
            const stateMap = stateIds.reduce((result, stateId) => {
                try {
                    const { state_name } = states.find(v => v.state_id == stateId)
                    const totalUsers = (users.filter(v => v.stateId == stateId )).length
                    if (totalUsers && !(result.find(v => v.state_name == state_name))) {
                        result.push({ state_name, totalUsers })
                    }
                } catch (err) { }
                return result
            }, []).sort((a, b) => b.totalUsers - a.totalUsers)
            const txt = stateMap.map(o => `<b>${o.state_name}</b>: ${o.totalUsers}`).join('\n')

            return await ctx.reply(txt + "\n\n You can send /locations StateName to get more info.\neg. /locations Gujarat", { parse_mode: 'HTML' })
        }
    } catch (error) {
        console.log(error)
    }
})

bot.action('not_booked', async (ctx) => {
    return await ctx.editMessageText(`No worries! You\'re still tracked for your current pincodes and age groups!.\nYou can check stat by /status\nWish you luck for the next time. :)`, { parse_mode: 'HTML' })
})

trackAndInform()
// set false and wait for 5mins if tracker updates the flag or not
setInterval(() => {
    TRACKER_ALIVE = false
}, 3 * 60 * 1000)
setInterval(() => {
    if (!TRACKER_ALIVE) {
        bot.telegram.sendMessage(SWAPNIL, 'ALERT: Tracker dead!')
        setTimeout(() => {
            console.log('Starting tracker again...')
            trackAndInform()
        }, 4 * 60 * 1000)
    }
}, 10 * 60 * 1000)

bot.launch()
