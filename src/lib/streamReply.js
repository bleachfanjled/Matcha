// Progressively reveals text word-by-word to simulate a live streamed reply.
// Returns a cancel function.
export function streamReply(text, onUpdate, onDone, speed = 24) {
  const words = text.match(/\S+|\s+/g) || [];
  let i = 0;
  let acc = '';
  const id = setInterval(() => {
    if (i >= words.length) {
      clearInterval(id);
      onDone && onDone();
      return;
    }
    acc += words[i++];
    onUpdate(acc);
  }, speed);
  return () => clearInterval(id);
}