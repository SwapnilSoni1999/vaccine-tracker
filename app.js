const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')
const path = require('path')

const User = require('./model')
const bot = require('./bot')

const app = express()
const JWT_SECRET = 'C0WiNGOVBOT_SWAPNIL'

app.use(cors())
app.use(morgan('tiny'))
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use('/axios', express.static(path.join(__dirname, 'node_modules', 'axios', 'dist')))

app.post('/api/bot/login', async (req, res, next) => {
    const { mobile } = req.body
    if (!mobile) {
        return res.status(400).json({ message: "`mobile` parameter is required!" })
    }
    const user = await User.findOne({ mobile })
    if (!user) {
        return res.status(404).json({ message: "User is not using the bot!" })
    }
    const appOtp = Math.floor(100000 + Math.random() * 900000)
    const { chatId } = await User.findOneAndUpdate({ mobile }, { $set: { appOtp } })
    res.status(200).json({ message: "OTP Sent!" })
    return await bot.telegram.sendMessage(chatId, `Your OTP for app login is: <b>${appOtp}</b>`, { parse_mode: 'HTML' })
})

app.post('/api/bot/verifyOtp', async (req, res, next) => {
    const { otp, mobile } = req.body
    if (!otp || !mobile) {
        return res.status(400).json({ message: "`otp` and `mobile` are required!" })
    }
    const user = await User.findOne({ mobile, appOtp: otp })
    if (!user) {
        return res.status(400).json({ message: "Invalid OTP!" })
    }
    const token = jwt.sign({ chatId: user.chatId, mobile: user.mobile }, JWT_SECRET)
    res.status(200).json({ message: "Login successful!", token })
    return await bot.telegram.sendMessage(user.chatId, 'Hi! Welcome to autologin app. The app will automatically will log you in whenever you logout! So this saves time and extra efforts. :)')
})

app.post('/api/cowin/token', async (req, res, next) => {
    const { token, tgToken: appToken } = req.body // token = cowin token
    if (!appToken) {
        return res.status(401).json({ message: "Unauthorized!" })
    }
    if (!token) {
        return res.status(400).json({ message: "`token` is required!" })
    }
    try {
        const { chatId, mobile } = jwt.verify(appToken, JWT_SECRET)
        const { source, mobile_number } = jwt.decode(token)
        if (source != 'cowin') {
            return res.status(400).json({ message: "`token` is not from cowin!" })
        }
        if (mobile_number != mobile) {
            return res.status(402).json({ message: "`token` is not from same user!" })
        }
        await User.updateOne({ chatId }, { $set: { token }, $inc: { otpCount: 1 } })
        return res.status(200).json({ message: "Handshaked cowin token!" })
    } catch (err) {
        return res.status(401).json({ message: "Unauthorized!" })
    }
})

app.post('/api/bot/me', async (req, res, next) => {
    const appToken = req.body.tgToken
    if (!appToken) {
        return res.status(401).json({ message: "Unauthorized!" })
    }
    try {
        const { chatId } = jwt.verify(appToken, JWT_SECRET)
        const user = await User.findOne({ chatId })
        return res.status(200).json({
            loggedIn: String(!!user.token),
            autobook: String(user.autobook),
            otpRequested: String(user.otpCount),
            mobile: user.mobile
        })
    } catch (err) {
        return res.status(401).json({ message: "Unauthorized!" })
    }
})

app.get('/login', async (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'))
})

module.exports = app

