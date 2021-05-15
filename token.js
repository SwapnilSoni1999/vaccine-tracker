const jwt = require('jsonwebtoken')
const User = require('./model')

const isValid = (token) => {
    if (!token) {
        return
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
    return validTokens[Math.floor(Math.random() * validTokens.length)]
}

module.exports = { isValid, getAnyValidToken }