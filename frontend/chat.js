document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SETUP INICIAL ---

    // Define a URL do seu servidor
    const API_URL = 'http://localhost:3000'; 
    const SOCKET_URL = 'http://localhost:3000';

    // Tenta pegar o usuário logado do localStorage
    let loggedInUser = null;
    try {
        // Assume que você salvou o usuário como um JSON string após o login
        loggedInUser = JSON.parse(localStorage.getItem('usuario'));
    } catch (e) {
        console.error('Nenhum usuário logado encontrado ou erro ao parsear:', e);
    }

    // Se não tiver usuário, redireciona para o login
    if (!loggedInUser || !loggedInUser.id) {
        alert('Você precisa estar logado para entrar no chat.');
        window.location.href = 'login.html'; // Mude para sua página de login
        return;
    }

    // Conecta ao servidor socket.io
    const socket = io(SOCKET_URL);

    // Referências do DOM
    const userListEl = document.getElementById('user-list');
    const chatAreaEl = document.getElementById('chat-area');
    const chatHeaderEl = document.getElementById('chat-with-header');
    const messagesEl = document.getElementById('messages');
    const chatFormEl = document.getElementById('chat-form');
    const chatInputEl = document.getElementById('chat-input');

    // Estado do Cliente
    let allMessages = new Map(); // Armazena o histórico de chat: Map(userId -> [array de mensagens])
    let currentChatPartner = { id: null, username: null };
    let onlineUsersMap = new Map(); // Armazena os usuários online: Map(userId -> {username, ...})

    
    // --- 2. LÓGICA DE CONEXÃO E REGISTRO ---

    // 2.1. Conecta e se registra no servidor
    socket.on('connect', () => {
        console.log('Conectado ao servidor, registrando...');
        console.log(loggedInUser)
        socket.emit('register', { 
            userId: loggedInUser.id, 
            username: loggedInUser.name 
        });
    });

    // 2.2. Recebe a lista de usuários online
    socket.on('update user list', (usersArray) => {
        userListEl.innerHTML = '';
        onlineUsersMap.clear();
        console.log(usersArray);

        usersArray.forEach(user => {
            // Não mostra você mesmo na lista (usando '==' para comparar string/número)
            if (user.userId == loggedInUser.id) {
                return; // Pula para o próximo usuário
            }
            console.log(user);
            onlineUsersMap.set(user.userId, user); // Salva no Map

            const userItem = document.createElement('div');
            userItem.className = 'user-list-item';
            userItem.textContent = user.username;
            userItem.dataset.userId = user.userId;
            
            // Adiciona o evento de clique para iniciar o chat
            userItem.addEventListener('click', () => {
                // Chama a função assíncrona para iniciar o chat e carregar o histórico
                startChatWith(user.userId, user.username);
            });
            userListEl.appendChild(userItem);
        });
    });

    
    // --- 3. LÓGICA DE MENSAGENS ---

    // 3.1. Recebe uma mensagem privada (seja nova ou um "eco" sua)
    socket.on('private message', (data) => {
        const { senderId, senderUsername, message, recipientId } = data;

        // Verifica se a mensagem é um "eco" (enviada por nós)
        // O servidor só adiciona 'recipientId' no eco
        const isMyOwnMessage = !!recipientId; 
        const partnerId = isMyOwnMessage ? recipientId : senderId;
        
        // Determina o texto e o tipo da mensagem
        const messageText = isMyOwnMessage ? `Você: ${message}` : `${senderUsername}: ${message}`;
        const messageData = { 
            text: messageText, 
            type: isMyOwnMessage ? 'sent' : 'received' 
        };

        // Salva a mensagem no cache local (histórico)
        if (!allMessages.has(partnerId)) {
            allMessages.set(partnerId, []);
        }
        allMessages.get(partnerId).push(messageData);

        // Se a mensagem for do chat atualmente ativo, exibe na tela
        if (partnerId === currentChatPartner.id) {
            addMessageToUI(messageData);
        } else {
            // Adiciona uma notificação no item do usuário na lista
            const userItem = userListEl.querySelector(`.user-list-item[data-user-id="${partnerId}"]`);
            if (userItem) {
                userItem.classList.add('new-message-notification');
            }
        }
    });

    // 3.2. Envia uma mensagem pelo formulário
    chatFormEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const message = chatInputEl.value.trim();

        if (message && currentChatPartner.id) {
            // Envia a mensagem privada para o servidor
            socket.emit('private message', {
                recipientId: currentChatPartner.id,
                message: message
            });
            chatInputEl.value = ''; // Limpa o input
        }
    });

    
    // --- 4. FUNÇÕES DE UI E CARREGAMENTO DE DADOS ---

    /**
     * Inicia um chat com um usuário e busca o histórico.
     * @param {number} userId - O ID do usuário parceiro de chat.
     * @param {string} username - O nome do usuário parceiro de chat.
     */
    async function startChatWith(userId, username) {
        currentChatPartner = { id: userId, username: username };

        // Atualiza a UI
        chatHeaderEl.textContent = `Conversando com ${username}`;
        chatFormEl.style.display = 'flex';
        messagesEl.innerHTML = ''; // Limpa as mensagens anteriores

        // Remove notificação de nova mensagem (se houver)
        const userItem = userListEl.querySelector(`.user-list-item[data-user-id="${userId}"]`);
        if (userItem) {
            userItem.classList.remove('new-message-notification');
        }

        // Limpa o cache de mensagens desse usuário para recarregar
        allMessages.delete(userId); 
        
        // Busca o histórico da API
        await fetchHistory(userId); 

        // Carrega o histórico de mensagens (agora preenchido)
        const history = allMessages.get(userId) || [];
        history.forEach(addMessageToUI);
    }

    /**
     * Busca o histórico de chat com um usuário específico na API.
     * @param {number} partnerId - O ID do usuário parceiro de chat.
     */
    async function fetchHistory(partnerId) {
        try {
            // Chama a nova rota da API
            const response = await fetch(`${API_URL}/chat/history/${loggedInUser.id}/${partnerId}`);
            const data = await response.json();
            console.log(data)

            if (!data.success) throw new Error(data.message);

            const historyMessages = [];

            data.history.forEach(msg => {
                // Verifica se a mensagem foi enviada por nós
                const isMyOwnMessage = (msg.sender_id == loggedInUser.id);
                
                const messageText = isMyOwnMessage ? `Você: ${msg.message}` : `${msg.senderUsername}: ${msg.message}`;
                const messageData = {
                    text: messageText,
                    type: isMyOwnMessage ? 'sent' : 'received'
                };
                historyMessages.push(messageData);
            });
            
            // Salva o histórico baixado no cache local
            allMessages.set(partnerId, historyMessages);

        } catch (err) {
            console.error('Erro ao buscar histórico:', err);
            messagesEl.innerHTML = '<li class="notification">Erro ao carregar histórico.</li>';
        }
    }

    /**
     * Adiciona uma única mensagem à tela do chat.
     * @param {object} messageData - O objeto da mensagem ({text, type}).
     */
    function addMessageToUI(messageData) {
        const item = document.createElement('li');
        item.className = messageData.type; // 'sent' ou 'received'
        item.textContent = messageData.text;
        messagesEl.appendChild(item);
        
        // Rola para a última mensagem
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
});