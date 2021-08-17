const { Schema, model } = require('mongoose')

const TrackingSchema = new Schema({
    pincode: { type: Number },
    age_group: { type: Number },
    dose: { type: Number, default: 0 }
}, {
    id: true,
})

const UserSchema = new Schema({
    chatId: { type: Number, required: true },
    allowed: { type: Boolean, default: false },
    mobile: { type: String },
    lastOtpRequested: { type: Number },
    snoozeTime: { type: Number },
    snoozedAt: { type: Number },
    txnId: { type: String, default: null },
    token: { type: String, default: null },
    stateId: { type: Number },
    districtId: { type: Number },
    tmpPincode: { type: Number },
    tmp_age_group: { type: Number },
    tmpDose: { type: Number },
    tracking: [{ type: TrackingSchema, default: [] }],
    beneficiaries: { type: Array, default: [] },
    preferredBenef: { type: Object, default: null },
    autobook: { type: Boolean, default: false },
    vaccine: { type: String, default: 'ANY' },
    otpCount: { type: Number, default: 0 },
    feeType: { type: String, default: 'ANY' },
    centers: [{ type: Number, default: [] }],
    walkthrough: { type: Boolean, default: false },
    expireCount: { type: Number, default: 0 },
    appOtp: { type: Number, default: null }
})

const User = model('User', UserSchema, 'users')

module.exports = User
