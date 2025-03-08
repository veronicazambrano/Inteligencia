import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './AssistantApp.css';

const AssistantApp = () => {
  const [apiKey, setApiKey] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [threadId, setThreadId] = useState('');
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState('setup'); // setup, chat
  
  const messagesEndRef = useRef(null);
  const client = useRef(null);

  // Configurar cliente OpenAI
  const setupClient = () => {
    // En un entorno real, deberías usar variables de entorno o un backend seguro
    client.current = axios.create({
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  };

  // Crear un nuevo asistente
  const createAssistant = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      setupClient();
      const response = await client.current.post('/beta/assistants', {
        name: "Math Tutor",
        instructions: "You are a personal math tutor. Write and run code to answer math questions.",
        tools: [{ type: "code_interpreter" }],
        model: "gpt-4o"
      });
      
      setAssistantId(response.data.id);
      createThread();
    } catch (err) {
      setError(`Error al crear el asistente: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Crear un nuevo thread
  const createThread = async () => {
    try {
      const response = await client.current.post('/beta/threads', {});
      setThreadId(response.data.id);
      setStep('chat');
      setIsLoading(false);
    } catch (err) {
      setError(`Error al crear el thread: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Enviar un mensaje al thread
  const sendMessage = async () => {
    if (!userInput.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    // Añadir mensaje del usuario a la UI
    const newUserMessage = { role: 'user', content: userInput, id: Date.now().toString() };
    setMessages(prev => [...prev, newUserMessage]);
    
    try {
      // Añadir mensaje al thread en la API
      await client.current.post(`/beta/threads/${threadId}/messages`, {
        role: "user",
        content: userInput
      });
      
      // Limpiar el input
      setUserInput('');
      
      // Ejecutar el thread para obtener la respuesta del asistente
      await runThread();
    } catch (err) {
      setError(`Error al enviar el mensaje: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Ejecutar el thread para generar la respuesta del asistente
  const runThread = async () => {
    try {
      // Crear un run
      const runResponse = await client.current.post(`/beta/threads/${threadId}/runs`, {
        assistant_id: assistantId
      });
      
      const runId = runResponse.data.id;
      
      // Verificar el estado del run periódicamente
      const checkRunStatus = async () => {
        const statusResponse = await client.current.get(`/beta/threads/${threadId}/runs/${runId}`);
        const status = statusResponse.data.status;
        
        if (status === 'completed') {
          // Obtener los mensajes actualizados
          const messagesResponse = await client.current.get(`/beta/threads/${threadId}/messages`);
          
          // Actualizar los mensajes en la UI
          const allMessages = messagesResponse.data.data.reverse();
          setMessages(allMessages.map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content[0].text.value
          })));
          
          setIsLoading(false);
        } else if (status === 'failed' || status === 'cancelled' || status === 'expired') {
          setError(`El proceso falló con estado: ${status}`);
          setIsLoading(false);
        } else {
          // Si todavía está en proceso, verificar nuevamente después de un tiempo
          setTimeout(checkRunStatus, 1000);
        }
      };
      
      // Iniciar la verificación de estado
      checkRunStatus();
      
    } catch (err) {
      setError(`Error al ejecutar el thread: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Scroll al final de los mensajes cuando hay nuevos
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Renderizar la pantalla de configuración
  const renderSetupScreen = () => (
    <div className="setup-container">
      <h2>Configurar Asistente de OpenAI</h2>
      <div className="input-group">
        <label htmlFor="api-key">API Key de OpenAI:</label>
        <input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
        />
      </div>
      <button 
        onClick={createAssistant} 
        disabled={!apiKey || isLoading}
        className="create-button"
      >
        {isLoading ? 'Creando...' : 'Crear Asistente'}
      </button>
    </div>
  );

  // Renderizar la interfaz de chat
  const renderChatScreen = () => (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h3>¡Bienvenido a tu Asistente Matemático!</h3>
            <p>Haz una pregunta matemática para comenzar.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-container">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Escribe tu pregunta matemática..."
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          disabled={isLoading}
        />
        <button 
          onClick={sendMessage} 
          disabled={!userInput.trim() || isLoading}
        >
          {isLoading ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="assistant-app">
      <header>
        <h1>Asistente Matemático con OpenAI</h1>
      </header>
      
      {error && <div className="error-message">{error}</div>}
      
      {step === 'setup' ? renderSetupScreen() : renderChatScreen()}
      
      <footer>
        <p>Usando OpenAI Assistants API con React</p>
      </footer>
    </div>
  );
};

export default AssistantApp;