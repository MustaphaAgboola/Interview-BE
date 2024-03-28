const mongoose = require("mongoose");

const subDialogueSchema = mongoose.Schema({
    id: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, "id not included "],
        ref: "user"
    },
    text: {
        type: String,
        required: true
    },
    dialogueId: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, "id not included "],
        ref: "dialogue"
    },
    scenerio: {
        type: String, 
    }

});

const subDialogue = mongoose.model("subDialogue", subDialogueSchema);

module.exports = subDialogue;