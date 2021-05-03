const fs = require('fs')
const users = JSON.parse(fs.readFileSync('db.json')).users

const newData = {
    users: []
}
for (const user of users) {
    const pincode = user.pincode
    const age_group = user.age_group
    if (pincode && age_group) {
        const newUser = { ...user, tracking: [{ pincode, age_group }] }
        delete newUser.pincode
        delete newUser.age_group
        newData.users.push(newUser)
    } else {
        const newUser = { ...user, tracking: [] }
        newData.users.push(newUser) 
    }
}

fs.writeFileSync('db.json', JSON.stringify(newData, null, '\t'))
