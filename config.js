// =====================================================================
//  CONFIGURAÇÕES DO JOGO  -  é aqui que você ajusta as suas sprites
// =====================================================================
//  Cada animação é UMA imagem PNG com os quadros lado a lado (horizontal).
//  Exemplo: "correndo.png" com 6 quadros => quadros: 6
//  O jogo calcula sozinho a largura de cada quadro (largura da imagem / quadros).
//  Se o arquivo NÃO existir, o jogo desenha um bonequinho provisório.
// =====================================================================

const CONFIG = {

  // Seus desenhos olham para a DIREITA? (true = sim, false = olham para a esquerda)
  // Se o personagem andar "de costas", troque aqui.
  spritesOlhamParaDireita: true,

  jogador: {
    largura: 80,  altura: 80,   // tamanho do desenho na tela (em pixels)
    vida: 5,
    velocidade: 260,
    pulo: 640,
    animacoes: {
      parado:   { arquivo: "assets/sprites/jogador/parado.png",   quadros: 8, fps: 8  },
      correndo: { arquivo: "assets/sprites/jogador/correndo.png", quadros: 8, fps: 14 },
      pulando:  { arquivo: "assets/sprites/jogador/pulando.png",  quadros: 1, fps: 1  },
      ataque:   { arquivo: "assets/sprites/jogador/ataque.png",   quadros: 3, fps: 10 },
      rolando:  { arquivo: "assets/sprites/jogador/rolando.png",  quadros: 2, fps: 8  }
    }
  },

  inimigo: {
    largura: 80,  altura: 80,
    vida: 3,
    velocidade: 60,
    visao: 240,                 // a que distância ele te percebe
    animacoes: {
      andando: { arquivo: "assets/sprites/inimigos/andando.png", quadros: 4, fps: 6, olhaParaDireita: false }
    }
  },

  moeda: { arquivo: "assets/sprites/itens/moeda.png", quadros: 5, fps: 8, tamanho: 22 },

  // Imagem de fundo (opcional). Ideal: altura 540px.
  fundo: { arquivo: "assets/sprites/fundo/fundo.png" },

  // Chão e plataformas (imagens em assets/sprites/terreno/)
  terreno: {
    topo: "assets/sprites/terreno/topo.png",
    corpo: "assets/sprites/terreno/corpo.png",
    plataforma: "assets/sprites/terreno/plataforma.png",
    largura: 78,   // largura de cada bloco do chão na tela
    sobra: 8       // quanto a grama sobe acima da linha do chão
  },

  fase: {
    segmentos: 8,   // tamanho da fase (mais = fase maior)
    seed: 0         // 0 = fase diferente a cada jogada; um número fixo = sempre a mesma fase
  }
};
