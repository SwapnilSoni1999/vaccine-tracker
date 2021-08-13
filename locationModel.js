const { Schema, model } = require('mongoose')

const LocationSchema = new Schema({
    stateId: { type: Number },
    districts: { type: Array }
})

const LocationModel = model('Location', LocationSchema, 'locations')

module.exports = { Location: LocationModel }
