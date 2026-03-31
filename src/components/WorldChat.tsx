import React, { useState, useEffect } from 'react';

const WorldChat = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');

    const handleSendMessage = () => {
        if (input.trim()) {
            setMessages(prevMessages => [...prevMessages, { text: input, isBot: false }]);
            setInput('');
            // Simulate bot response
            setTimeout(() => {
                setMessages(prevMessages => [...prevMessages, { text: 'Bot: ' + input, isBot: true }]);
            }, 1000);
        }
    };

    return (
        <div style={{ width: '300px', border: '1px solid #ccc', padding: '10px' }}>
            <div style={{ height: '200px', overflowY: 'scroll', marginBottom: '10px' }}>
                {messages.map((msg, index) => (
                    <div key={index} style={{ textAlign: msg.isBot ? 'left' : 'right' }}>
                        <strong>{msg.isBot ? 'Bot' : 'You'}: </strong>{msg.text}
                    </div>
                ))}
            </div>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                style={{ width: '70%' }}
            />
            <button onClick={handleSendMessage}>Send</button>
        </div>
    );
};

export default WorldChat;