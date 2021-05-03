const fs = require('fs')
const nanoid = require('nanoid').nanoid
const users = JSON.parse(fs.readFileSync('db.json')).users

const newData = {
    users: []
}
for (const user of users) {
    const tracking = user.tracking
    if (Array.isArray(tracking) && tracking.length) {
        const newTracking = []
        for (const t of tracking) {
            if (!t.id) {
                const nt = { ...t, id: nanoid() }
                newTracking.push(nt)
            }
        }
        const newUser = { ...user, tracking: newTracking }
        newData.users.push(newUser)
    }
}

fs.writeFileSync('db.json', JSON.stringify(newData, null, '\t'))
