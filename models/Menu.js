const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MenuSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    menuName: {
        type: String,
        required: true
    },
    heading: {
        type: String,
        required: true
    },
    dishes: {
        type: [String],
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Menu', MenuSchema);
