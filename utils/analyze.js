import axios from 'axios';

export async function analyzeMessage(text) {
  const res = await axios.post("https://mist-chat-widget.vercel.app/api/analyze", {
    message: text
  });
  return res.data;
}
