const jwt = require('jsonwebtoken')
const User = require('./model')

exports.isValid = (token) => {
    const { exp } = jwt.decode(token)
    return !(Date.now() >= exp*1000)
}

exports.getAnyValidToken = async () => {
    const users = await User.find({ token: { $ne: null } })
    const validTokens = users.filter(u => this.isValid(u.token))
    return validTokens[Math.floor(Math.random() * validTokens.length)]
}

// this.getAnyValidToken().then(data => console.log(data))
console.log(isValid('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX25hbWUiOiIxZmY3N2MyNi0zZGE1LTQxY2EtOTE1Zi1kMGU4ZDg4YWVlZGMiLCJ1c2VyX2lkIjoiMWZmNzdjMjYtM2RhNS00MWNhLTkxNWYtZDBlOGQ4OGFlZWRjIiwidXNlcl90eXBlIjoiQkVORUZJQ0lBUlkiLCJtb2JpbGVfbnVtYmVyIjo5NjYyMDM1NzYxLCJiZW5lZmljaWFyeV9yZWZlcmVuY2VfaWQiOjYxMzE4NDUzNDc3NDMwLCJzZWNyZXRfa2V5IjoiYjVjYWIxNjctNzk3Ny00ZGYxLTgwMjctYTYzYWExNDRmMDRlIiwidWEiOiJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdpbjY0OyB4NjQ7IHJ2OjU5LjApIEdlY2tvLzIwMTAwMTAxIEZpcmVmb3gvNTkuMCIsImRhdGVfbW9kaWZpZWQiOiIyMDIxLTA1LTE1VDE1OjExOjM2LjU1MloiLCJpYXQiOjE2MjEwOTE0OTYsImV4cCI6MTYyMTA5MjM5Nn0._E1u5qSGCxUjGdh_pQjWPQJj3zkKDvIw-zb5nw31fAk'))
