const fs = require('fs')
const users = JSON.parse(fs.readFileSync('db.json'))
const { Types: { ObjectId } } = require('mongoose')
const newData = {
    users: []
}

for (const user of users) {
    const newUser = { ...user }
    if (Array.isArray(newUser.tracking) && newUser.tracking.length) {
        const newTracking = newUser.tracking.map(o => {
            if (o) {
                return { pincode: o.pincode, age_group: o.age_group, _id: ObjectId() }
            }
        })
        newUser.tracking = newTracking
    }
    newData.users.push(newUser)
}

fs.writeFileSync('db.json', JSON.stringify(newData.users, null, '\t'))
