const express = require('express');
const cors = require('cors');
const connection = require('./db_config');
const app = express();

const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
    cors: {
        origin: "*", // Em produção, mude para o URL do seu frontend
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const port = 3000;

app.get('/', (req, res) => {
    return res.send('Hello, World!')
})

// =============================================
// LÓGICA DO CHAT PRIVADO COM SOCKET.IO
// =============================================

// Usaremos um Map para rastrear: userId -> { socketId, username }
const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('Um usuário se conectou:', socket.id);

    // 1. Quando um usuário se "registra" após conectar
    socket.on('register', ({ userId, username }) => {
        // Armazena a info do usuário
        onlineUsers.set(userId, { socketId: socket.id, username: username });
        
        socket.userId = userId;
        console.log(`${username} (ID: ${userId}) registrou-se com o socket ${socket.id}`);
        
        // --- CORREÇÃO AQUI ---
        // Precisamos transformar o Map em um Array que inclua o ID e o Nome
        const usersList = Array.from(onlineUsers.entries()).map(([id, data]) => {
            return { userId: id, username: data.username };
        });

        // Envia a lista de usuários atualizada para TODOS os clientes
        io.emit('update user list', usersList);
    });

    // 2. Quando o servidor recebe uma mensagem privada
    socket.on('private message', (data) => {
        const { recipientId, message } = data;
        const senderId = socket.userId; // Pegamos o ID do remetente a partir do socket
        const senderUsername = onlineUsers.get(senderId)?.username;

        // Encontra o socket do destinatário
        const recipientSocket = onlineUsers.get(recipientId);

        if (recipientSocket && senderUsername) {
            const payload = {
                senderId: senderId,
                senderUsername: senderUsername,
                message: message,
            };

            // Envia a mensagem para o destinatário
            io.to(recipientSocket.socketId).emit('private message', payload);

            // Envia um "eco" da mensagem de volta para o remetente
            // Adicionamos 'recipientId' para o cliente do remetente saber para quem foi
            io.to(socket.id).emit('private message', { ...payload, recipientId: recipientId });

        } else {
            // Opcional: avisar ao remetente que o usuário está offline
            console.log(`Usuário ${recipientId} não está online.`);
            socket.emit('user offline', recipientId);
        }
    });

    // 3. Quando o usuário desconecta
    socket.on('disconnect', () => {
        console.log('Usuário desconectou:', socket.id);
        
        if (socket.userId && onlineUsers.has(socket.userId)) {
            onlineUsers.delete(socket.userId);
            
            // --- CORREÇÃO AQUI ---
            // Envia a lista atualizada após a desconexão
            const usersList = Array.from(onlineUsers.entries()).map(([id, data]) => {
                return { userId: id, username: data.username };
            });

            io.emit('update user list', usersList);
            console.log(`Usuário ID: ${socket.userId} removido da lista.`);
        }
    });
});
// Cadastro do usuário
app.post('/usuario/cadastro', (req, res) => {
    const { name, cpf, email, password} = req.body;
    
    const query = 'INSERT INTO usuario (name, cpf, email, password) VALUES (?, ?, ?, ?)'
    connection.query(query, [name, cpf, email, password], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, err, message: 'Erro no servidor'})
        }
        res.status(201).json({success: true, results, message: 'Sucesso no cadastro!'})
    })
})

// Verificar usuário
app.get('/usuario', (req, res) => {

    const query = 'SELECT * FROM usuario'
    connection.query(query, (err, results) => {
        if(err) {
            return res.status(500).json({ success: false, err, message: 'Erro ao buscar usuário'})
        } 
        res.json({success: true, usuario: results})
    })
})

// Editar usuário
app.put('/usuario/:id', (req, res) => {
    const { id } = req.params
    const { name, email, password } = req.body

    const query = 'UPDATE usuario SET name = ?, email = ?, password = ? WHERE id = ?'
    connection.query(query, [name, email, password, id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, err, message: 'Erro ao editar usuário'})
        }
        res.json({ success: true, message: 'Usuário editado com sucesso!' })
    })
})

// Deletar usuário
app.delete('/usuario/:id', (req, res) => {
    const { id } = req.params
    const query = 'DELETE FROM usuario WHERE id = ?'
    connection.query(query, [id], (err) => {
        if (err) {
            return res.status(500).json({ success: false, err, message: 'Erro ao deletar usuário' })
        }
        res.json({ success: true, message: 'Usuário deletado com sucesso' })
    })
})


// Login do usuário
app.post('/usuario/login', (req, res) => {
    const {name, email, password} = req.body

    const query = 'SELECT * FROM usuario WHERE name = ? AND email = ? AND password = ?'
    connection.query(query, [name, email, password], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Erro no servidor!'})
    }

    if (results.length > 0) {
        res.json({ success: true, message: 'Sucesso no login!', data: results[0]})
    } else {
        res.json({ succes: false, message: 'Usuário ou senha incorretos!'})
    } 
    })
})

// =============================================
// ROTAS DO FÓRUM
// =============================================

// Criar um novo post
app.post('/forum/post', (req, res) => {
    const { user_id, content } = req.body;

    if (!user_id || !content) {
        return res.status(400).json({ success: false, message: 'Faltam dados (user_id, content)' });
    }

    const query = 'INSERT INTO posts (user_id, content) VALUES (?, ?)';
    connection.query(query, [user_id, content], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, err, message: 'Erro no servidor ao criar post' });
        }
        res.status(201).json({ success: true, message: 'Post criado com sucesso!', postId: results.insertId });
    });
});

// Listar todos os posts (com nome do autor e contagem de likes)
app.get('/forum/posts', (req, res) => {
    // Este query usa um JOIN para pegar o nome do usuário e um SUBQUERY para contar os likes
    const query = `
        SELECT 
            p.id, 
            p.content, 
            p.created_at, 
            u.name AS user_name,
            (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count
        FROM posts p
        JOIN usuario u ON p.user_id = u.id
        ORDER BY p.created_at DESC
    `;

    connection.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, err, message: 'Erro ao buscar posts' });
        }
        res.json({ success: true, posts: results });
    });
});

// ... (depois da rota app.get('/forum/posts'))

// Listar posts de UM usuário específico
app.get('/forum/posts/user/:user_id', (req, res) => {
    const { user_id } = req.params;

    const query = `
        SELECT 
            p.id, 
            p.content, 
            p.created_at, 
            u.name AS user_name,
            (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count
        FROM posts p
        JOIN usuario u ON p.user_id = u.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
    `;

    connection.query(query, [user_id], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, err, message: 'Erro ao buscar posts do usuário' });
        }
        res.json({ success: true, posts: results });
    });
});


// Listar comentários de um post específico
app.get('/forum/comments/:post_id', (req, res) => {
    const { post_id } = req.params;
    
    const query = `
        SELECT c.id, c.content, c.created_at, u.name AS user_name
        FROM comments c
        JOIN usuario u ON c.user_id = u.id
        WHERE c.post_id = ?
        ORDER BY c.created_at ASC
    `;

    connection.query(query, [post_id], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, err, message: 'Erro ao buscar comentários' });
        }
        res.json({ success: true, comments: results });
    });
});

// Adicionar um novo comentário
app.post('/forum/comment', (req, res) => {
    const { post_id, user_id, content } = req.body;

    if (!post_id || !user_id || !content) {
        return res.status(400).json({ success: false, message: 'Faltam dados (post_id, user_id, content)' });
    }

    const query = 'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)';
    connection.query(query, [post_id, user_id, content], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, err, message: 'Erro no servidor ao criar comentário' });
        }
        res.status(201).json({ success: true, message: 'Comentário criado com sucesso!', commentId: results.insertId });
    });
});

// Dar like / tirar o like (toggle)
app.post('/forum/like', (req, res) => {
    const { post_id, user_id } = req.body;

    if (!post_id || !user_id) {
        return res.status(400).json({ success: false, message: 'Faltam dados (post_id, user_id)' });
    }

    // 1. Verifica se o like já existe
    const checkQuery = 'SELECT * FROM likes WHERE post_id = ? AND user_id = ?';
    connection.query(checkQuery, [post_id, user_id], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, err, message: 'Erro no servidor (check like)' });
        }

        if (results.length > 0) {
            // 2a. Se existe, remove (unlike)
            const deleteQuery = 'DELETE FROM likes WHERE post_id = ? AND user_id = ?';
            connection.query(deleteQuery, [post_id, user_id], (err) => {
                if (err) {
                    return res.status(500).json({ success: false, err, message: 'Erro ao remover like' });
                }
                res.json({ success: true, message: 'Like removido' });
            });
        } else {
            // 2b. Se não existe, adiciona (like)
            const insertQuery = 'INSERT INTO likes (post_id, user_id) VALUES (?, ?)';
            connection.query(insertQuery, [post_id, user_id], (err) => {
                if (err) {
                    // Ignora o erro de "Entrada duplicada" se houver uma corrida de condição, mas loga outros
                    if (err.code !== 'ER_DUP_ENTRY') {
                         return res.status(500).json({ success: false, err, message: 'Erro ao adicionar like' });
                    }
                }
                res.status(201).json({ success: true, message: 'Like adicionado' });
            });
        }
    });
});

// =============================================
// ROTAS DO CHAT (HISTÓRICO)
// =============================================

// Rota para buscar o histórico de chat entre dois usuários
app.get('/chat/history/:userId1/:userId2', (req, res) => {
    const { userId1, userId2 } = req.params;

    // Busca mensagens onde (remetente=1 E destinatário=2) OU (remetente=2 E destinatário=1)
    const query = `
        SELECT 
            m.sender_id, 
            m.message, 
            m.created_at,
            u.name AS senderUsername
        FROM private_messages m
        JOIN usuario u ON m.sender_id = u.id
        WHERE 
            (m.sender_id = ? AND m.recipient_id = ?) OR 
            (m.sender_id = ? AND m.recipient_id = ?)
        ORDER BY m.created_at ASC
    `;

    connection.query(query, [userId1, userId2, userId2, userId1], (err, results) => {
        if (err) {
            return res.status(500).json({ success: false, err, message: 'Erro ao buscar histórico' });
        }
        res.json({ success: true, history: results });
    });
});


server.listen(port, () => console.log(`Server rodando na porta ${port}`))