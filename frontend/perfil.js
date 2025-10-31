// perfil.js
document.addEventListener('DOMContentLoaded', () => {

    const API_URL = 'http://localhost:3000';

    // --- 1. VERIFICAR LOGIN ---
    let loggedInUser = null;
    try {
        loggedInUser = JSON.parse(localStorage.getItem('usuario'));
    } catch (e) {
        console.error('Erro ao buscar usuário:', e);
    }

    if (!loggedInUser || !loggedInUser.id) {
        alert('Você precisa estar logado para ver seu perfil.');
        window.location.href = 'login.html'; // Mude se sua pág de login tiver outro nome
        return;
    }

    // --- 2. PEGAR ELEMENTOS DO DOM ---
    const usernameEl = document.getElementById('profile-username');
    const logoutBtn = document.getElementById('btn-sair');
    const deleteBtn = document.getElementById('btn-deletar');
    const createPostForm = document.getElementById('create-post-form');
    const postContentInput = document.getElementById('publicacao');
    const myPostsContainer = document.getElementById('my-posts-container');

    // --- 3. INICIALIZAR PÁGINA ---
    usernameEl.textContent = loggedInUser.name; // Define o nome do usuário
    loadMyPosts(); // Carrega os posts do usuário

    // --- 4. ADICIONAR EVENT LISTENERS ---

    // Botão SAIR
    logoutBtn.addEventListener('click', () => {
        if (confirm('Tem certeza que deseja sair?')) {
            localStorage.removeItem('user');
            alert('Você foi desconectado.');
            window.location.href = 'index.html'; // Volta para a pág inicial
        }
    });

    // Botão DELETAR PERFIL
    deleteBtn.addEventListener('click', async () => {
        if (confirm('TEM CERTEZA ABSOLUTA?\nIsso é irreversível e apagará sua conta e todos os seus posts.')) {
            try {
                const response = await fetch(`${API_URL}/usuario/${loggedInUser.id}`, {
                    method: 'DELETE'
                });
                const data = await response.json();

                if (data.success) {
                    localStorage.removeItem('user');
                    alert('Sua conta foi deletada com sucesso.');
                    window.location.href = 'index.html';
                } else {
                    throw new Error(data.message);
                }
            } catch (err) {
                console.error('Erro ao deletar perfil:', err);
                alert('Não foi possível deletar seu perfil.');
            }
        }
    });

    // Formulário CRIAR POST
    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Impede o recarregamento da página
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
                postContentInput.value = ''; // Limpa o textarea
                loadMyPosts(); // Recarrega os posts para mostrar o novo
            } else {
                throw new Error(data.message);
            }

        } catch (err) {
            console.error('Erro ao criar post:', err);
            alert('Não foi possível criar o post.');
        }
    });


    // --- 5. FUNÇÕES ---

    // Função para CARREGAR OS POSTS DO USUÁRIO
    async function loadMyPosts() {
        try {
            const response = await fetch(`${API_URL}/forum/posts/user/${loggedInUser.id}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message);
            }

            myPostsContainer.innerHTML = ''; // Limpa os posts antigos

            if (data.posts.length === 0) {
                myPostsContainer.innerHTML = '<p>Você ainda não fez nenhuma publicação.</p>';
                return;
            }

            data.posts.forEach(post => {
                const postElement = createPostElement(post);
                myPostsContainer.appendChild(postElement);
            });

        } catch (err) {
            console.error('Erro ao carregar meus posts:', err);
            myPostsContainer.innerHTML = '<p>Erro ao carregar posts.</p>';
        }
    }

    // Função para CRIAR O HTML DE UM POST
    function createPostElement(post) {
        const section = document.createElement('section');
        section.className = 'section';
        // Formatando a data (opcional, mas legal)
        const postDate = new Date(post.created_at).toLocaleDateString('pt-BR');

        section.innerHTML = `
            <h4>@${post.user_name} (em ${postDate})</h4>
            <p>${post.content}</p>
            <hr>
            <div class="div-acoes">
                <img src="./assets/comentario.png" alt="Comentários">
                <img src="./assets/coracao.png" alt="Likes">
                <span class="like-count">${post.like_count}</span>
            </div>
        `;
        // Adicionar lógica de like/comentário aqui se necessário
        return section;
    }
});