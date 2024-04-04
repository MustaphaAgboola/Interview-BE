const mongoose = require('mongoose');

const translateSchema = mongoose.Schema({
    id: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, "id not included "],
        ref: "user"
    },

    translateText: {
        type: String
    },

    dialogueId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, "id not included"],
        ref: "dialogue"
    },

    subDialogueId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, "id not included"],
        ref: "subDialogue"
    },

    status: {
        type: Boolean,
        required: true,
        default: false
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, "id not included"],
        ref: "user"
    }
});

const translate = mongoose.model("translate", translateSchema);

module.exports = translate