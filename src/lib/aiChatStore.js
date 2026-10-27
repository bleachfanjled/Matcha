// Module-level AI chat store. The conversation lives in memory here so it
// survives navigating away from the AI page and back — the AIPage component
// remounts, but it reads from this same store, so the same chat reappears.
//
// "Save chats" (default on) mirrors the conversation to localStorage so it also
// survives a full browser/app close. When saving is off, the chat lives only in
// memory and is cleared when Matcha closes.

import { localData } from '@/lib/localData';

const SAVE_NAME = 'chats_save';
const CHAT_NAME = 'chats';
localData.migrateFrom('matcha:ai_save_chats', SAVE_NAME);
localData.migrateFrom('matcha:ai_chat', CHAT_NAME);

let saveChats = localData.getString(SAVE_NAME) !== '0';
let messages = saveChats ? load() : [];

function load() {
  return localData.get(CHAT_NAME) || [];
}
function persist() {
  if (saveChats) localData.set(CHAT_NAME, messages);
  else localData.remove(CHAT_NAME);
}

const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const aiChatStore = {
  getMessages: () => messages,
  getSaveChats: () => saveChats,
  setMessages(next) {
    messages = typeof next === 'function' ? next(messages) : next;
    persist();
    emit();
  },
  clear() { messages = []; persist(); emit(); },
  setSaveChats(val) {
    saveChats = !!val;
    localData.setRaw(SAVE_NAME, saveChats ? '1' : '0');
    persist(); // turning on saves the current chat; turning off wipes the stored copy
    emit();
  },
  subscribe(l) { listeners.add(l); return () => listeners.delete(l); },
};