import { useState } from 'react';

type Message = {
  text: string;
  isBot: boolean;
};

const WorldChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const handleSendMessage = () => {
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      return;
    }

    setMessages((prevMessages) => [...prevMessages, { text: trimmedInput, isBot: false }]);
    setInput('');

    window.setTimeout(() => {
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: trimmedInput, isBot: true },
      ]);
    }, 1000);
  };

  return (
    <div style={{ width: '300px', border: '1px solid #ccc', padding: '10px' }}>
      <div style={{ height: '200px', overflowY: 'scroll', marginBottom: '10px' }}>
        {messages.map((msg, index) => (
          <div key={`${msg.text}-${index}`} style={{ textAlign: msg.isBot ? 'left' : 'right' }}>
            <strong>{msg.isBot ? 'Bot' : 'You'}: </strong>
            {msg.text}
          </div>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Type your message..."
        style={{ width: '70%' }}
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  );
};

export default WorldChat;
