const mario = document.querySelector('.mario');
const pipe = document.querySelector('.pipe');
const clouds = document.querySelector('.clouds');
const clouds_2 = document.querySelector('.clouds_2');
const backgroundMusic = document.querySelector('.backgroundMusic');
const startButton = document.querySelector('.startButton');
const marioDeathSound = document.querySelector('.marioDeathSound');
const retryButton = document.querySelector('.retryButton');
const idleMario = document.querySelector('.idleMario');

let gameStarted = false;

const jump = () => {

    if (!mario.classList.contains('jump')) {

        mario.classList.add('jump');

        setTimeout(() => {
            mario.classList.remove('jump');
        }, 800);

    }
}

if (gameStarted == false) {
    pipe.style.animationPlayState = 'paused';
    clouds.style.animationPlayState = 'paused';
    clouds_2.style.animationPlayState = 'paused';
    mario.style.display = 'none';
}

document.addEventListener('keydown', (event) => {

    if (event.code === 'Space') {

        gameStarted = true;

        if (gameStarted) {
            backgroundMusic.play();
            pipe.style.animationPlayState = 'running';
            clouds.style.animationPlayState = 'running';
            clouds_2.style.animationPlayState = 'running';
            mario.style.display = 'block';
            idleMario.style.display = 'none';
            startButton.style.display = 'none';
        }

        jump();
    }
});


const loop = setInterval(() => {

    const pipePosition = pipe.offsetLeft;
    const marioPosition = +window.getComputedStyle(mario).bottom.replace('px', '');

    console.log(marioPosition);

    if (pipePosition <= 120 && marioPosition < 80 && pipePosition > 0) {

        backgroundMusic.pause();
        marioDeathSound.play();

        document.addEventListener('keydown', (event) => {

            if (event.code === 'Space') {
                backgroundMusic.pause();
                jump();
            }
        });

        pipe.style.animation = 'none';
        pipe.style.left = `${pipePosition}px`;

        mario.style.animation = 'none';
        mario.style.bottom = `${marioPosition}px`;

        mario.src = './images/game-over.png';
        mario.style.width = '75px';
        mario.style.marginLeft = '50px';

        retryButton.style.display = 'block';

        const cloudAnimation = clouds.getAnimations()[0];
        cloudAnimation.updatePlaybackRate(0.2);

        const cloudAnimation2 = clouds_2.getAnimations()[0];
        cloudAnimation2.updatePlaybackRate(0.2);

        clearInterval(loop);
    }

}, 10);