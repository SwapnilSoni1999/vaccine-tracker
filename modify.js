const fs = require('fs')
const nanoid = require('nanoid').nanoid
const users = JSON.parse(fs.readFileSync('db.json')).users

const newData = {
    users: []
}

for (const user of users) {
    const newUser = { ...user }
    if (Array.isArray(newUser.tracking) && newUser.tracking.length) {
        newUser.tracking = []
    }
    newData.users.push(newUser)
}

fs.writeFileSync('db.json', JSON.stringify(newData, null, '\t'))
