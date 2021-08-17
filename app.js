const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')

const User = require('./model')
const bot = require('./bot')

const app = express()
const JWT_SECRET = 'C0WiNGOVBOT'

app.use(cors())
app.use(express.urlencoded({ extended: false }))
app.use(express.json())

app.post('/api/bot/login', async (req, res, next) => {
    const { mobile } = req.body
    const user = await User.findOne({ mobile })
    if (!user) {
        return res.status(404).json({ message: "User is not using the bot!" })
    }
    const appOtp = Math.floor(100000 + Math.random() * 900000)
    const { chatId } = await User.findOneAndUpdate({ mobile }, { $set: { appOtp } })
    res.status(200).json({ message: "OTP Sent!" })
    return await bot.telegram.sendMessage(chatId, `Your OTP for app login is: <b>${appOtp}</b>`)
})

app.post('/api/bot/verifyOtp', async (req, res, next) => {
    const { otp, mobile } = req.body
    const user = await User.findOne({ mobile, appOtp: otp })
    if (!user) {
        return res.status(400).json({ message: "Invalid OTP!" })
    }
    const token = jwt.sign({ chatId: user.chatId, mobile: user.mobile }, JWT_SECRET)
    return res.status(200).json({ message: "Login successful!", token })
})

app.post('/api/cowin/token', async (req, res, next) => {
    const { token } = req.body // token = cowin token
    const appToken = req.headers.authorization
    try {
        const { chatId } = jwt.verify(appToken, JWT_SECRET)
        const { source } = jwt.decode(token)
        if (source !== 'cowin') {
            return res.status(400).json({ message: "`token` is not from cowin!" })
        }
        await User.updateOne({ chatId }, { token })
        return res.status(200).json({ message: "Handshaked cowin token!" })
    } catch (err) {
        return res.status(401).json({ message: "Unauthorized!" })
    }
})

module.exports = app

