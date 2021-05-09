const fs = require('fs')
const nanoid = require('nanoid').nanoid
const users = JSON.parse(fs.readFileSync('db.json')).users

const newData = {
    users: []
}

for (const user of users) {
    const newUser = { ...user }
    if (Array.isArray(newUser.tracking) && newUser.tracking.length > 2) {
        newUser.tracking.splice(2, newUser.tracking.length)
    }
    newData.users.push(newUser)
}

fs.writeFileSync('db.json', JSON.stringify(newData, null, '\t'))
