const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    menuName: {
        type: String,
        required: true
    },
    heading: {
        type: String,
        required: true
    },
    dishes: [{
        type: String,
        required: true
    }]
});

module.exports = mongoose.model('Menu', menuSchema);
