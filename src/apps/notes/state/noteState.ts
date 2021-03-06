import { Action, thunk, Thunk, listen, Listen } from "easy-peasy"
import { isEqual, shuffle, times, uniqBy } from "lodash"
import { StoreModel } from "src/store"
import { notes as notesModel } from "src/apps/notes/state"
import { settingsState } from "src/apps/settings/settingsState"
import { getNote } from "src/utils/fretboard/getNote"
import { Note, HINT_VISIBILITY_TIME, ANSWER_COUNT } from "src/utils/types"
import { playNote } from "src/utils/fretboard/playNote"

export interface NotesState {
  currentNote: Note
  questions: Note[]
  questionCount: number

  listeners: Listen<NotesState>

  // Actions
  setQuestions: Action<NotesState, Note[]>
  pickAnswer: Thunk<NotesState, string, any, StoreModel>
  pickRandomNote: Thunk<NotesState, void>
  setNote: Action<NotesState, Note>
}

export const notesState: NotesState = {
  currentNote: {
    note: "c",
    position: [5, 3],
  },
  questions: [...new Array(4)].map(getNote),
  questionCount: 4,

  // When these actions fire pick a new note, effectively resetting the
  // fretboard state
  listeners: listen(on => {
    const newNoteActions = [
      notesModel.settings.setStartingFret,
      notesModel.settings.setStringFocus,
      settingsState.setFretboardMode,
    ]

    newNoteActions.forEach(action => {
      on(
        action,
        thunk(actions => {
          actions.pickRandomNote()
        })
      )
    })
  }),

  pickAnswer: thunk((actions, selectedNote, { getState, dispatch }) => {
    const {
      notes: { currentNote },
      settings: { isMuted },
    } = getState()

    const isCorrect = isEqual(
      currentNote.note.toLowerCase(),
      selectedNote.toLowerCase()
    )

    if (isCorrect) {
      dispatch.scoreboard.correctAnswer("correct!")
      if (!isMuted) {
        playNote(currentNote)
      }
    } else {
      dispatch.scoreboard.incorrectAnswer("incorrect!")
    }

    setTimeout(() => {
      actions.pickRandomNote()
    }, HINT_VISIBILITY_TIME)
  }),

  pickRandomNote: thunk((actions, _, { getState }) => {
    const state = getState() as StoreModel

    const getNotes = () => {
      const { fretboard } = state.settings
      const { startingFret, stringFocus } = state.notes.settings

      const notes = uniqBy(
        times(ANSWER_COUNT, () => {
          return getNote({
            fretboard,
            startingFret,
            stringFocus,
          })
        }),
        "note"
      )

      if (notes.length < ANSWER_COUNT) {
        return getNotes()
      }

      return notes
    }

    const notes = getNotes()

    actions.setNote(notes[0])
    actions.setQuestions(notes)
  }),

  setNote: (state, currentNote) => {
    state.currentNote = currentNote
  },

  setQuestions: (state, questions) => {
    state.questions = shuffle(questions)
  },
}
