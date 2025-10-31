create database entreLutos;
use entreLutos;
 
create table usuario(
	id int primary key auto_increment,
    name varchar(255) not null,
    cpf varchar(255) not null,
    email varchar(255) not null,
    password varchar(255) not null,
    seguidores int,
    imagemPerfil varchar(255),
    criadoEm timestamp default current_timestamp
);
 
create table seguir(
	seguidor int,
    seguindo int,
    foreign key (seguidor) references usuario(id),
    foreign key (seguindo) references usuario(id)

);
 
create table publicacao(
	id int primary key auto_increment,
    conteudo varchar(255) not null,
    dataUpload timestamp default current_timestamp,
    url varchar(255) not null,
    curtidas int,
    usuario_id int,
	foreign key (usuario_id) references usuario(id)
);
 
create table comentario(
	id int primary key auto_increment,
	texto varchar(255) not null,
    dataEnvio timestamp default current_timestamp,
    publicacao int,
    usuario_id int,
    foreign key (publicacao) references publicacao(id),
    foreign key (usuario_id) references usuario(id)
);
 
create table chat(
	id int primary key auto_increment,
    usuario_id int,
    criadoEm timestamp default current_timestamp,
    foreign key (usuario_id) references usuario(id)
);
 
create table mensagem(
	id int primary key auto_increment,
    texto varchar(255),
    enviadoEm timestamp default current_timestamp
);
 
create table grupoApoio(
	id int primary key auto_increment,
    criadoEm timestamp default current_timestamp
);
 
create table membroGrupo(
	id int primary key auto_increment,
    criadoEm timestamp default current_timestamp
);

CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES usuario(id) ON DELETE CASCADE,
    UNIQUE KEY unique_like (post_id, user_id) 
);

select * from usuario; 