const jwt = require('jsonwebtoken')
const User = require('./model')

const isValid = (token) => {
    if (!token) {
        return false
    }
    try {
        const { exp } = jwt.decode(token)
        return !(Date.now() >= exp*1000)
    } catch (err) {
        console.log(err)
        return false
    }
}

const getAnyValidToken = async () => {
    const users = await User.find({ token: { $ne: null } })
    const validTokens = users.filter(u => isValid(u.token))
    try {
        const { token } = validTokens[Math.floor(Math.random() * validTokens.length)]
        return token
    } catch (err) {
        return null
    }
}

const getExpirationTime = (token) => {
    const { exp } = jwt.decode(token)
    return Math.floor(Math.abs(Date.now() - (exp*1000))/1000)
}

module.exports = { isValid, getAnyValidToken, getExpirationTime }