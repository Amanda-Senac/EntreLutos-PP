// forum.js
document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'http://localhost:3000'; // URL do seu servidor
    const postsContainer = document.getElementById('posts-container');
    const postContentInput = document.getElementById('post-content-input');
    const submitPostBtn = document.getElementById('submit-post-btn');

    // 1. Tenta pegar o usuário logado do localStorage
    let loggedInUser = null;
    try {
        loggedInUser = JSON.parse(localStorage.getItem('usuario'));
    } catch (e) {
        console.error('Nenhum usuário logado encontrado.', e);
    }

    // Se não tiver usuário, redireciona para o login
    if (!loggedInUser || !loggedInUser.id) {
        alert('Você precisa estar logado para ver o fórum.');
        window.location.href = 'login.html';
        return;
    }

    // --- FUNÇÕES PRINCIPAIS ---

    /**
     * Carrega todos os posts da API e os exibe
     */
    async function loadPosts() {
        try {
            const response = await fetch(`${API_URL}/forum/posts`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message);
            }

            postsContainer.innerHTML = ''; // Limpa os posts antigos
            for (const post of data.posts) {
                const postElement = createPostElement(post);
                postsContainer.appendChild(postElement);

                // Carrega os comentários para este post
                await loadComments(post.id, postElement.querySelector('.comments-list'));
            }

        } catch (err) {
            console.error('Erro ao carregar posts:', err);
            postsContainer.innerHTML = '<p>Erro ao carregar posts.</p>';
        }
    }

    /**
     * Cria o elemento HTML para um único post
     */
    function createPostElement(post) {
        const postCard = document.createElement('div');
        postCard.className = 'section post-card'; // Reutilizando sua classe 'section'
        postCard.dataset.postId = post.id;

        postCard.innerHTML = `
            <h5 class="post-author">${post.user_name}</h5>
            <p class="post-content">${post.content}</p>
            <div class="div-acoes">
                <button class="like-btn">❤️</button>
                <span class="like-count">${post.like_count}</span>
            </div>
            
            <div class="comments-section">
                <h6>Comentários</h6>
                <div class="comments-list">
                    </div>
                <div class="comment-form">
                    <input type="text" class="comment-input" placeholder="Escreva um comentário...">
                    <button class="comment-submit-btn button-form">Comentar</button>
                </div>
            </div>
        `;

        // Adiciona Event Listeners para os botões deste post
        const likeBtn = postCard.querySelector('.like-btn');
        likeBtn.addEventListener('click', () => handleLike(post.id));

        const commentSubmitBtn = postCard.querySelector('.comment-submit-btn');
        commentSubmitBtn.addEventListener('click', () => {
            const commentInput = postCard.querySelector('.comment-input');
            handleComment(post.id, commentInput.value);
            commentInput.value = ''; // Limpa o input
        });

        return postCard;
    }

    /**
     * Carrega os comentários de um post específico
     */
    async function loadComments(postId, commentsListElement) {
        try {
            const response = await fetch(`${API_URL}/forum/comments/${postId}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message);
            }

            commentsListElement.innerHTML = ''; // Limpa
            if (data.comments.length === 0) {
                commentsListElement.innerHTML = '<p class="no-comments">Nenhum comentário ainda.</p>';
            }

            for (const comment of data.comments) {
                const commentElement = document.createElement('div');
                commentElement.className = 'comment';
                commentElement.innerHTML = `
                    <strong>${comment.user_name}:</strong>
                    <p>${comment.content}</p>
                `;
                commentsListElement.appendChild(commentElement);
            }

        } catch (err) {
            console.error(`Erro ao carregar comentários do post ${postId}:`, err);
        }
    }


    // --- HANDLERS (Funções que cuidam dos eventos) ---

    /**
     * Cuida da criação de um novo post
     */
    async function handleCreatePost() {
        const content = postContentInput.value.trim();
        if (!content) {
            alert('Você não pode criar um post vazio.');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/forum/post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: content,
                    user_id: loggedInUser.id
                })
            });

            const data = await response.json();
            
            if (data.success) {
                postContentInput.value = ''; // Limpa o input
                loadPosts(); // Recarrega todos os posts
            } else {
                throw new Error(data.message);
            }

        } catch (err) {
            console.error('Erro ao criar post:', err);
            alert('Não foi possível criar o post.');
        }
    }

    /**
     * Cuida do clique no botão de "Like"
     */
    async function handleLike(postId) {
        try {
            const response = await fetch(`${API_URL}/forum/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post_id: postId,
                    user_id: loggedInUser.id
                })
            });
            
            const data = await response.json();
            if (data.success) {
                // Atualiza a contagem de likes na tela
                const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
                const likeCountElement = postCard.querySelector('.like-count');
                let currentLikes = parseInt(likeCountElement.textContent);
                
                if (data.message === 'Like adicionado') {
                    likeCountElement.textContent = currentLikes + 1;
                } else {
                    likeCountElement.textContent = currentLikes - 1;
                }
            } else {
                 throw new Error(data.message);
            }
        } catch (err) {
             console.error('Erro ao dar like:', err);
        }
    }

    /**
     * Cuida da criação de um novo comentário
     */
    async function handleComment(postId, content) {
        if (!content.trim()) {
            alert('Comentário não pode ser vazio.');
            return;
        }

        try {
             const response = await fetch(`${API_URL}/forum/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    post_id: postId,
                    user_id: loggedInUser.id,
                    content: content
                })
            });

            const data = await response.json();
            if (data.success) {
                // Recarrega os comentários desse post específico
                const postCard = document.querySelector(`.post-card[data-post-id="${postId}"]`);
                const commentsListElement = postCard.querySelector('.comments-list');
                loadComments(postId, commentsListElement);
            } else {
                throw new Error(data.message);
            }
        } catch (err) {
            console.error('Erro ao comentar:', err);
        }
    }

    // --- INICIALIZAÇÃO ---

    // Adiciona o listener para o botão principal de criar post
    submitPostBtn.addEventListener('click', handleCreatePost);

    // Carrega os posts assim que a página é aberta
    loadPosts();
});