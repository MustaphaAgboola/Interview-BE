const mongoose = require('mongoose');

const translateSchema = mongoose.Schema({
    
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

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, "id not included"],
        ref: "user"
    }
});

const Translate = mongoose.model("Translate", translateSchema);

module.exports = Translate