/** @format */

/**
 *
 * @param {boolean} test
 * @param {string} text
 */
function assert(test, text = "[Like, some error]") {
	if (IS_RELEASE) return;

	if (!test) {
		console.error("ASSERT FAILED: ", text);
		debugger;
	}
}

/** @format */

class Coin extends EngineObject {
	static count = 0;

	constructor(pos) {
		super(pos, vec2(1), spriteAtlas.coin);
		this.yOrig = pos.y;
		this.index = Coin.count;
		this.setCollision(true, false, false);
		Coin.count++;
	}

	update(o) {
		//super.update(); // NO super update !

		this.pos.y = this.yOrig + Math.sin(this.index / 5 + time * 15) / 15;
	}

	collideWithObject(o) {
		if (o != player) return false;

		// check if player in range
		const d = this.pos.distanceSquared(player.pos);

		if (d > 1) return false;

		// award points and destroy
		++score;

		sound_score.play(this.pos);

		this.destroy();

		makeCollectEffect(this.pos, 0.1);
		makeDebris(this.pos, new Color(0.5, 1, 1), randInt(5, 10), 0.05, 0.1, 0.05);

		Coin.count--;

		if (Coin.count == 0) levelShowExit();

		return false;
	}
}

/** @format */

var Colors = {
	white: new Color(1, 1, 1),
	grey: new Color(0.5, 0.5, 0.5),
};

/** @format */

class ConcreteBlock extends EngineObject {
	constructor(pos) {
		super(pos, vec2(8, 8), spriteAtlas.concreteBlock);
		this.setCollision(true, false, true);
		this.elasticity = 0.2;
	}

	collideWithObject(o) {
		if (o instanceof Player) {
			o.destroy();
			player = null;

			makeBlood(o.pos, 1000);
			sound_splat.play(this.pos);

			setTimeout(() => {
				sound_squark.play(o.pos, 2, 0.8);
				sound_squark.play(o.pos, 2, 0.6);
			}, 200);

			sound_explosion.play(o.pos, 5);
		}
		return false;
	}
}

// /** @format */

// class Enemy extends GameObject {
// 	constructor(pos) {
// 		super(pos, vec2(0.9, 0.9), spriteAtlas.enemy);

// 		this.drawSize = vec2(1);
// 		this.color = hsl(rand(), 1, 0.7);
// 		this.health = 5;
// 		this.bounceTimer = new Timer(rand(1e3));
// 		this.setCollision(true, false);
// 	}

// 	update() {
// 		super.update();

// 		if (!player) return;

// 		// jump around randomly
// 		if (this.groundObject && rand() < 0.01 && this.pos.distance(player.pos) < 20) {
// 			this.velocity = vec2(rand(0.1, -0.1), rand(0.4, 0.2));
// 			sound_jump.play(this.pos, 0.4, 2);
// 		}

// 		if (isOverlapping(this.pos, this.size, player.pos, player.size)) {
// 			if (player.velocity.y < -0.1) {
// 				this.kill();
// 			} else {
// 				player.damage(1, this);
// 			}
// 		}
// 	}

// 	kill() {
// 		if (this.destroyed) return;

// 		++score;
// 		sound_score.play(this.pos);
// 		makeDebris(this.pos, this.color);
// 		this.destroy();
// 	}

// 	render() {
// 		// bounce by changing size
// 		const bounceTime = this.bounceTimer.time * 6;
// 		this.drawSize = vec2(1 - 0.1 * Math.sin(bounceTime), 1 + 0.1 * Math.sin(bounceTime));

// 		// make bottom flush
// 		let bodyPos = this.pos;
// 		bodyPos = bodyPos.add(vec2(0, (this.drawSize.y - this.size.y) / 2));
// 		drawTile(bodyPos, this.drawSize, this.tileInfo, this.color, this.angle, this.mirror, this.additiveColor);
// 	}
// }

/** @format */

class Exit extends EngineObject {
	constructor(pos) {
		super(pos, vec2(2, 2), spriteAtlas.exit);

		this.setCollision(true, false, true);

		sound_exitAppear.play(this.pos);

		makeDebris(this.pos, new Color(1, 1, 1), 25, 0.05, 0.01, 0.05);
		makeDebris(this.pos, new Color(1, 1, 1), 25, 0.1, 0.1, 0.05);
	}

	collideWithObject(o) {
		if (o instanceof Player) {
			if (o.pos.distanceSquared(this.pos) < 2) {

				gameNextLevel();
			}
		}
		return false;
	}

	collideWithTile() {
		if (abs(this.velocity.y) > 0.1) sound_explosion.play(this.pos, 0.1 + abs(this.velocity.y / 2));

		return true;
	}
}

/** @format */

let spriteAtlas, score, level, transitionFrames, timeLeft;

let bonusText, bonusAmmount, bonusGivenTime;

let GameState = {
	PLAY: 0,
	GAME_OVER: 1,
	WON: 2,
};

let gameState = GameState.PLAY;
const TRANSITION_FRAMES = 180;
const TIME_BONUS_SCORE = 100;
const LIVE_BONUS_SCORE = 5000;
const TIME_MAX = 45;
const LIVES_START = 3;

let gameBottomText = undefined;
let lives = undefined;
let titleSize;
var gameIsNewHiscore = false;
let gameBlinkFrames = 0;
let cameraShake = vec2();

let title;

///////////////////////////////////////////////////////////////////////////////
function gameInit() {
	// create a table of all sprites
	spriteAtlas = {
		coin: tile(0),
		blob: tile(1),
		playerWalk: tile(2),
		playerJump: tile(4),
		exit: tile(6),
		concreteBlock: tile(9),
	};

	// enable touch gamepad on touch devices
	touchGamepadEnable = true;
	gameIsNewHiscore = false;

	transitionFrames = score = level = 0;
	gravity = -0.01;
	gameState = GameState.PLAY;

	lives = LIVES_START;
	titleSize = 7;

	levelBuild(level);
	musicInit(level);

	VictoryRocket.destroyAllLive();

	// 移除图像标题，改用文本标题
}

function gameSetState(newState) {
	gameBottomText = undefined;
	gameState = newState;

	switch (newState) {
		case GameState.GAME_OVER:
			levelStartTime = time;
			levelBuild(14);
			musicInit(22);
			new ConcreteBlock(vec2(levelSize.x / 2, levelSize.y * 4));
			gameIsNewHiscore = savefileUpdateHiscore(score);
			break;

		case GameState.WON:
			level = 13;
			gameNextLevel();
			level = 31;
			musicInit(level);
			musicOn = true;
			levelStartTime = time;

			gameBonusSet("生命奖励 ", lives * LIVE_BONUS_SCORE, 2);
			break;

		default:
			break;
	}
}

function gameNextLevel() {
	if (transitionFrames > 0) return;

	musicPlayCrash();

	sound_exit.play(player.pos, 3);
	player.jumpToNextLevel();

	gameBlinkFrames = 10;
	gameCameraShake();

	musicOn = false;

	gameBonusSet("时间奖励 ", Math.ceil((timeLeft + 1) * TIME_BONUS_SCORE));

	transitionFrames = TRANSITION_FRAMES;
}

function gameUpdate() {
	musicUpdate();

	switch (gameState) {
		case GameState.WON:
			if (gameBonusUpdate()) {
				gameIsNewHiscore = savefileUpdateHiscore(score);
			}

			VictoryRocket.spawnRandom();
			cameraPos = cameraPos.lerp(player.pos, 0.05);
			if (time - levelStartTime > 7) {
				if (!gameBottomText) sound_exitAppear.play();
				gameBottomText = "[点击开始新游戏]";
				if (inputJumpReleased()) gameInit();
			}
			break;

		case GameState.GAME_OVER:
			if (time - levelStartTime > 5) {
				if (!gameBottomText) sound_exitAppear.play();
				gameBottomText = "[点击开始新游戏]";
				if (inputJumpReleased()) gameInit();
			}
			cameraScale = min(mainCanvas.width / levelSize.x, mainCanvas.height / levelSize.y);
			cameraPos = levelSize.scale(0.5);
			break;

		case GameState.PLAY:
			if (transitionFrames > 0) {
				let transProgress = (TRANSITION_FRAMES - transitionFrames) / TRANSITION_FRAMES;

				// Bonus
				if (level > 0) gameBonusUpdate();

				// Camera

				cameraPos.y += levelSize.y * 0.035 * transProgress;
				cameraScale *= 0.992;
				titleSize *= 0.992;
				cameraPos = cameraPos.lerp(player.pos, transProgress / 10);

				player.drawSize = player.drawSize.scale(1.02);

				transitionFrames--;

				if (transitionFrames <= 0) {
					if (level == 0) score = 0;
					bonusText = undefined;
					gameSkipToLevel(++level);
				}
			} else {
				if (player) timeLeft = TIME_MAX - (time - levelStartTime);

				if (timeLeft <= -1 && level != 0) {
					player.kill(true);
				}

				timeLeft = max(timeLeft, 0);

				if (level == 0) {
					//gameBottomText = levelTexts[level];
					//gameBottomText = "LUMIN跳跃游戏: 13 chambers of fowl play";
					gameBottomText = isTouchDevice ? "[点击跳跃]" : "[空格键跳跃]";

					timeLeft = 0;
				} else {
					gameBottomText = "第 " + level + " 室，共13室";
					// if (levelTexts[level]) gameBottomText += ". " + levelTexts[level];
				}
				cameraScale = min(mainCanvas.width / levelSize.x, mainCanvas.height / levelSize.y);
				cameraPos = levelSize.scale(0.5);
			}
			break;
	}

	if (!IS_RELEASE) {
		if (keyWasPressed("KeyG")) {
			lives = 1;
			player?.kill();
		}

		if (keyWasPressed("KeyW")) {
			level = 13;
			gameNextLevel();
		}

		if (keyWasPressed("KeyK")) player.kill();
		if (keyWasPressed("KeyN")) gameNextLevel();
		if (keyWasPressed("KeyT")) levelStartTime = time - TIME_MAX - 1;
	}

	if (!IS_RELEASE || gameState == GameState.WON) {
		if (keyWasPressed("PageUp")) gameSkipToLevel(++level);
		if (keyWasPressed("PageDown")) gameSkipToLevel(--level);
	}

	cameraShake = cameraShake.scale(-0.9);
	cameraPos = cameraPos.add(cameraShake);
}

function gameCameraShake(strength = 1) {
	strength /= 2;
	cameraShake = cameraShake.add(randInCircle(strength, strength / 2));
}

function gameUpdatePost() {}

function gameSkipToLevel(newLevel) {
	gameBottomText = "";

	if (gameState == GameState.WON) {
		musicInit(level);
		return;
	}

	if (newLevel == 14) {
		gameSetState(GameState.WON);
		return;
	}

	level = mod(newLevel, levelData.length);
	levelBuild(level);
	musicInit(level);
	musicOn = true;
	//playMusic();
}

function gameDrawHudText(
	text,
	x,
	y,
	sizeFactor = 1,
	fontName = "SimHei, monospace",
	fillColor = "#fff",
	outlineColor = "#000"
) {
	let fontSize = overlayCanvas.width / 40;

	fontSize = clamp(fontSize, 10, 20);
	fontSize *= sizeFactor;

	let outlineWidth = fontSize / 10;

	overlayContext.textAlign = "center";
	overlayContext.textBaseline = "middle";
	overlayContext.font = fontSize + "px " + fontName;

	let dShadow = fontSize / 10;

	// drop shadow
	overlayContext.fillStyle = outlineColor;
	overlayContext.lineWidth = outlineWidth;
	overlayContext.strokeStyle = outlineColor;
	overlayContext.strokeText(text, x + dShadow, y + dShadow);
	overlayContext.fillText(text, x + dShadow, y + dShadow);

	// text
	overlayContext.fillStyle = fillColor;
	overlayContext.lineWidth = outlineWidth;
	overlayContext.strokeStyle = outlineColor;
	overlayContext.strokeText(text, x, y);
	overlayContext.fillText(text, x, y);
}

function gameRender() {}

function gameRenderPost() {
	let halfTile = (overlayCanvas.height * 0.5) / levelSize.y;

	switch (gameState) {
		case GameState.PLAY:
			//gameDrawHudText(levelTexts[level], overlayCanvas.width * 0.5, overlayCanvas.height - halfTile);

			if (level == 0) {
				if (savefileGetHiscore())
					gameDrawHudText("最高分 " + savefileGetHiscore(), overlayCanvas.width * 0.5, halfTile);

				// 绘制艺术字标题
				let titlePos = worldToScreen(vec2(levelSize.x / 2, levelSize.y * 0.75));
				gameDrawHudText(
					"跳跃姬",
					titlePos.x,
					titlePos.y,
					titleSize / 3,
					"serif", // 使用艺术字字体
					"#e0cc5b" // 黄色
				);

				let subtitleTopPos = worldToScreen(vec2(levelSize.x / 2, levelSize.y * 0.45));
				let subtitleBottomPos = worldToScreen(vec2(levelSize.x / 2, levelSize.y * 0.4));
				let subtitleColor = "#e0cc5b";

				gameDrawHudText(
					"进入 LUMIN跳跃游戏",
					subtitleTopPos.x,
					subtitleTopPos.y,
					titleSize / 6,
					undefined,
					subtitleColor
				);

				gameDrawHudText(
					"13个有趣的房间",
					subtitleBottomPos.x,
					subtitleBottomPos.y,
					titleSize / 6,
					undefined,
					subtitleColor
				);
			} else {
				gameDrawHudText("生命 " + lives, (overlayCanvas.width * 1) / 4, halfTile);
				gameDrawHudText("分数 " + score, (overlayCanvas.width * 2) / 4, halfTile);

				let timeColor = "#fff";

				if (timeLeft <= 10 && transitionFrames <= 0) {
					if ((time * 4) % 2 < 1) timeColor = "#f00";
				}

				gameDrawHudText(
					"时间 " + Math.ceil(timeLeft),
					(overlayCanvas.width * 3) / 4,
					halfTile,
					undefined,
					undefined,
					timeColor
				);

				if (bonusText) gameDrawHudText(bonusText + bonusAmmount, overlayCanvas.width / 2, halfTile * 3, 0.7);
			}

			break;

		case GameState.GAME_OVER:
			gameDrawScoreStuff(halfTile);

			gameDrawHudText("游戏结束", overlayCanvas.width / 2, overlayCanvas.height * 0.15, 5);
			gameDrawHudText("小心13的危险！", overlayCanvas.width / 2, overlayCanvas.height * 0.3, 2);

			gameDrawHudText("第 " + level + " 室，共13室", overlayCanvas.width / 2, overlayCanvas.height - 3 * halfTile, 1);

			break;

		case GameState.WON:
			gameDrawScoreStuff(halfTile);

			if (bonusText && time - bonusGivenTime > -1 && !gameIsNewHiscore)
				gameDrawHudText(bonusText + bonusAmmount, overlayCanvas.width / 2, halfTile * 3, 0.7);

			gameDrawHudText("自由飞翔！", overlayCanvas.width / 2, overlayCanvas.height * 0.85, 3);

			if (!isTouchDevice) {
				gameDrawHudText(
					"[上/下页键切换音乐。第 " + level + " 室]",
					(overlayCanvas.width * 2) / 4,
					overlayCanvas.height - halfTile * 3
				);
			}

			break;
	}

	if (gameBottomText) gameDrawHudText(gameBottomText, overlayCanvas.width * 0.5, overlayCanvas.height - halfTile);

	mainContext.drawImage(overlayCanvas, 0, 0);

	if (player) player.renderTop(); // On top of everything !

	if (gameBlinkFrames > 0) {
		gameBlinkFrames--;
		let alpha = 0.2 + gameBlinkFrames / 10;
		alpha = min(alpha, 1);

		drawRect(mainCanvasSize.scale(0.5), mainCanvasSize, new Color(1, 1, 1, alpha), 0, undefined, true);
	}
}

function gameDrawScoreStuff(halfTile) {
	let scoreText = "分数 " + score;
	if (savefileGetHiscore()) {
		scoreText += "          最高分 " + savefileGetHiscore();
	}
	gameDrawHudText(scoreText, overlayCanvas.width / 2, halfTile);
	if (gameIsNewHiscore && (time * 2) % 2 > 1) gameDrawHudText("新最高分", overlayCanvas.width / 2, halfTile * 3, 2);
	return scoreText;
}

// BONUS STUFF

function gameBonusSet(text, ammount, initPause = 1) {
	bonusText = text;
	bonusAmmount = ammount;
	bonusGivenTime = time + initPause;
}

// Returns true on the frame it is done counting
function gameBonusUpdate() {
	if (time - bonusGivenTime > 5) bonusText = undefined;
	if (time - bonusGivenTime < 0) return false; // Intial pause
	if (bonusAmmount <= 0) return false;

	if (transitionFrames % 2 == 0) {
		sound_score.play();

		if (bonusAmmount > TIME_BONUS_SCORE) {
			score += TIME_BONUS_SCORE;
			bonusAmmount -= TIME_BONUS_SCORE;
		} else {
			score += bonusAmmount;
			bonusAmmount = 0;
			return true;
		}
	}

	return false;
}

engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost, ["tiles.png"]);

/** @format */

///////////////////////////////////////////////////////////////////////////////
// sound effects

//const sound_die = new Sound([1.4, , 100, 0.07, 0.02, 0.04, 2, 0.5, , , -500, 0.2, , , 0.1, , 0.1, 0.86, 0.38, , 15]);
const sound_jump = new Sound([0.4, 0.2, 250, 0.04, , 0.04, , , 1, , , , , 3]);
const sound_dodge = new Sound([0.4, 0.2, 150, 0.05, , 0.05, , , -1, , , , , 4, , , , , 0.02]);
const sound_walk = new Sound([0.3, 0.1, 50, 0.005, , 0.01, 4, , , , , , , , 10, , , 0.5]);
const sound_score = new Sound([1.04, 0, 2e3, , 0.02, 0.01, , 2.2, , , 50, , , , , , , 0.5, 0.01]); // Loaded Sound 1197

// prettier-ignore
const sound_splat = new Sound([2,.1,523.2511,.13,,.12,4,1.23,-46.2,,-100,.01,.01,,114,,.21,.85,.05]); // Loaded Sound 1385

// prettier-ignore
const sound_squark = new Sound([1, 0.2, 600, 0.05, 0.13, 0.13, 2, 0.5, 50, , 10, 0.11, 0.02, , 20, 0.12, , , , 0.5, 5e3 ]);

// prettier-ignore
const sound_explosion = new Sound([4,.5,802,.1,.05,.5,4,4.59,,,,,,1.2,,2,.21,.31,.1,.1]);

// prettier-ignore
const sound_exit = new Sound([.7,,118,.03,.28,.41,1,.2,-6,-162,-109,.05,.1,,,,,.51,.27,.06,496]); // Powerup 1173

const sound_exitAppear = new Sound([, , 336, 0.03, 0.21, 0.3, , 2.1, , -22, , , 0.1, 0.4, , , , 0.77, 0.12]); // Powerup 1180

const sound_rocketFly = new Sound([0.2, 0.1, 1e3, , 0.2, 2, , 0, -0.1, , , , , 0.3, , , , , 0.15]);

// No getting fainter w range
sound_explosion.range = 0;
sound_rocketFly.range = 0;

///////////////////////////////////////////////////////////////////////////////
// special effects

// const persistentParticleDestroyCallback = (particle) => {
// 	// copy particle to tile layer on death
// 	//ASSERT(!particle.tileInfo, "quick draw to tile layer uses canvas 2d so must be untextured");
// 	if (particle.groundObject)
// 		tileLayers[0].drawTile(
// 			particle.pos,
// 			particle.size,
// 			particle.tileInfo,
// 			particle.color,
// 			particle.angle,
// 			particle.mirror
// 		);
// };

function makeBlood(pos, amount) {
	let emitter = makeDebris(pos, hsl(0, 1, 0.5), amount, 0.2, 0);
	emitter.gravityScale = 1.2;
}

function makeDebris(pos, color = hsl(), amount = 50, size = 0.2, elasticity = 0.3, speed = 0.1) {
	const color2 = color.lerp(hsl(), 0.5);
	const fadeColor = color.copy();
	fadeColor.a = 0;

	const emitter = new ParticleEmitter(
		pos,
		0,
		1,
		0.1,
		amount / 0.1,
		PI,
		undefined,
		color,
		color2,
		fadeColor,
		fadeColor,
		3,
		size,
		size,
		speed / 10,
		0.05,
		1,
		0.95,
		0.5,
		PI,
		0, // random
		0.1,
		true
	);
	emitter.elasticity = elasticity;
	//emitter.particleDestroyCallback = persistentParticleDestroyCallback;
	return emitter;
}

function makeCollectEffect(pos, force = 1) {
	new ParticleEmitter(
		pos,
		0, // angle
		0.5, // eimtSize
		0.1, // emitTime
		100 * force, // emitRate
		PI / 2, // emitConeAngle
		undefined, // tileinfo
		rgb(1, 1, 1),
		rgb(1, 1, 1),
		rgb(0, 1, 1, 0),
		rgb(1, 1, 1, 0),
		0.5, // particleTime
		0.1, // sizeStart
		0.4, // sizeEnd
		0.01, // speed
		0.05, // damp
		0.9, // angledamp
		1, // angleDamp
		-0.2, // gravityScale
		PI, // particleConeAngle
		0.05, // fadeRate
		0.0, // randomness
		false, // col tile
		true, // additive
		true, // linearColor
		5 // renderOrder
	);
}

function makeSmoke(pos, force = 1) {
	// smoke
	new ParticleEmitter(
		pos, // pos
		0, // angle
		0.2 * force, // radius / 2, // emitSize
		0.3, // emitTime
		rand(50, 150) * force, // emitRate
		PI, // emiteCone
		spriteAtlas.blob,
		rgb(1, 1, 1),
		rgb(0.5, 0.5, 0.5),
		rgb(1, 1, 1),
		rgb(1, 1, 1),
		0.3, // time
		0.3, // sizeStart
		0.05, // sizeEnd
		0.01 / 10, // speed
		0.1, // angleSpeed
		0.9, // damp
		0.9, // angleDamp
		-0.1, // gravity
		PI, // particle cone
		0.5, // fade
		0.5, // randomness
		false, // collide
		false, // additive
		true, // colorLinear
		0 // renderOrder
	);
}

/** @format */

function inputJumpHeld() {
	return keyIsDown("Space") || gamepadIsDown(0) || mouseIsDown(0);
}

function inputJumpPressed() {
	return keyWasPressed("Space") || gamepadWasPressed(0) || mouseWasPressed(0);
}

function inputJumpReleased() {
	return keyWasReleased("Space") || gamepadWasReleased(0) || mouseWasReleased(0);
}

/** @format */

const tileType_empty = 0;
const tileType_ground = 1;
const tileType_spike = 2;

// NO, game much better without ...
// let levelTexts = [
// 	// 0
// 	isTouchDevice ? "Tap screen to jump" : "Space to jump",

// 	// 1
// 	"Hold down jump button for a long jump",
// 	"Make wall jumps by holding down jump button",
// 	"Release jump button to break the jump",
// 	"Sometimes doing nothing is best",
// 	"Finding a good path is key to completing a level fast",

// 	// 6
// 	"",
// 	"",
// 	"",
// 	"",

// 	"",
// 	"",
// 	"",
// ];

// let levelTexts = [
// 	"Enter the LUMIN跳跃游戏",

// 	"Welcome young apprentince",
// 	"Here you will learn LUMIN跳跃姬",
// 	"Never forget our lost paradise the island of Mauritius",
// 	"Where our forefathers fought our eternal enemies the evil dutchlings",
// 	"We evolved from pigeons to become flightless",
// 	"",

// 	"We are fligtless but not fightless",
// 	"Our cause is just",
// 	"Just one more cause",

// 	"",
// 	"",
// 	"",
// 	"",
// 	"",

// 	"",
// 	"",
// 	"",
// ];

// let levelTexts = [
// 	"Enter the Dojo of Dodo knowledge !",

// 	"The Dodo lived on the island of Mauritius",
// 	"The Dodo was 1 meter tall (3 feet) and weighted 23 kilos (50 pounds)",
// 	"The Dodo laid only one egg at a time",
// 	"The closest living relative is the Nicobar Pigeon",
// 	"Very few physical remains of the Dodo is left today",
// 	"The is a Dodo in 'Alice's Adventures in Wonderland'",
// 	"The Dodo evolved from lost pigeons over hundreds of thousands of years",
// 	"The Dodo adapted to their peaceful island sorounding to become flightless",
// 	"The Dodo was first seen by Dutch settlers in 1598",
// 	"Less than 65 years later, the Dodo was completely extinct",
// 	"The last confirmed sighting of the Dodo was in 1662",
// 	"Until humans, the Dodo had no predators",
// 	"The Dodo weren't really all that tasty",
// ];

let player, playerStartPos, tileData, tileLayers, sky;
let exitStartPos = undefined;
let exit = undefined;
let levelSize;
let levelStartTime = -1;

const levelSetTileData = (pos, layer, data) =>
	pos.arrayCheck(tileCollisionSize) && (tileData[layer][((pos.y | 0) * tileCollisionSize.x + pos.x) | 0] = data);

const levelGetTileData = (pos, layer) =>
	pos.arrayCheck(tileCollisionSize) ? tileData[layer][((pos.y | 0) * tileCollisionSize.x + pos.x) | 0] : 0;

function levelBuild(level) {
	Coin.count = 0;

	exitStartPos = undefined;
	exit = undefined;

	playerStartPos = undefined;
	tileData = undefined;
	tileLayers = undefined;
	sky = undefined;

	levelLoad(level);
	sky = new Sky();
	levelSpawnPlayer();
	levelStartTime = time;
}

function levelSpawnPlayer() {
	//if (gameState == GameState.GAME_OVER) return;

	if (player) player.destroy();

	player = new Player(playerStartPos);
}

function levelLoad(levelNumber) {
	engineObjectsDestroy();

	const tileMapData = levelData[levelNumber];
	levelSize = vec2(tileMapData.w, tileMapData.h);
	initTileCollision(levelSize);

	// create table for tiles in the level tilemap
	const tileLookup = {
		coin: 1,
		player: 3,
		ground: 6,
		exit: 7,
		spike: 8,
		steel: 9,
	};

	// set all level data tiles
	tileData = [];
	tileLayers = [];
	playerStartPos = vec2(1, levelSize.y);
	// const layerCount = tileMapData.layers.length;
	// for (let layer = layerCount; layer--; ) {
	const layerData = tileMapData.d;
	const tileLayer = new TileLayer(vec2(), levelSize, tile(0, 16));
	tileLayer.renderOrder = -1e3;
	tileLayers[0] = tileLayer;
	tileData[0] = [];

	for (let x = levelSize.x; x--; )
		for (let y = levelSize.y; y--; ) {
			const pos = vec2(x, levelSize.y - 1 - y);
			const tile = layerData[y * levelSize.x + x];
			const objectPos = pos.add(vec2(0.5));

			// Create objects
			switch (tile) {
				case tileLookup.coin:
					new Coin(objectPos);
					continue;

				case tileLookup.player:
					playerStartPos = objectPos;
					continue;

				case tileLookup.exit:
					exitStartPos = objectPos;
					continue;

				case tileLookup.spike:
					levelSetTileData(pos, 0, tile);
					setTileCollisionData(pos, tileType_spike);
					tileLayer.setData(pos, new TileLayerData(tile - 1));
					break;

				case tileLookup.steel:
				case tileLookup.ground:
					levelSetTileData(pos, 0, tile);
					setTileCollisionData(pos, tileType_ground);

					let direction = 0,
						mirror = 0;

					if (tile == tileLookup.ground) {
						direction = randInt(4);
						mirror = randInt(2);
					}

					tileLayer.setData(pos, new TileLayerData(tile - 1, direction, !!mirror));
			}
		}
	tileLayer.redraw();
}

function levelShowExit() {
	if (exit) return;
	exit = new Exit(exitStartPos);
}

/** @format */

var patterns = [[]];

var musicSongLength = 0;

var instrumentParamaters = [
	[1, 0, 43, 0.01, 0.5, 0.5, , 0.5], // 0 bass
	[20, 0, 170, 0.003, , 0.008, , 0.97, -35, 53, , , , , , 0.1], // 1 base drum
	[0.8, 0, 270, , , 0.12, 3, 1.65, -2, , , , , 4.5, , 0.02], // 2 snare
	[1, 0, 77, , 0.3, 0.7, 2, 0.41, , , , , , , , 0.06], // 3 melody lead
	[2, , 400, , , 0.5, 2, 0.1, , 1, , , , 2.5, , 0.5, , 0.5, 0.1], // 4 crash
];

var instrumentList = [];

var songData = [
	instrumentList,
	patterns, // patterns
	[1], // sequence (NOT USED)
	80, // BPM
];

function unfoldPattern(instrument, pan, startnode, pattern, starts) {
	var nodes = [];
	nodes.push(instrument);
	nodes.push(pan);

	for (const s of starts) {
		for (const b of pattern) {
			nodes.push(startnode + b + s);
		}
	}

	return nodes;
}

function mutateInstrumentParams(instrument, rng) {
	//console.log(instrument);

	// skipping the first X paramters (vol, rand, and freq)
	for (let i = 4; i < instrument.length; i++) {
		if (typeof instrument[i] == "number") {
			instrument[i] = rng.float(instrument[i] * 0.5, instrument[i] * 1.5);
		}
	}

	//console.log(instrument);
}

function musicIsNode(n) {
	return typeof n == "number" && !isNaN(n);
}

let melodyNodes = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // major pent

function createMutatedMelody(melody, swaps = 5, mutations = 5, rng, dHafltones) {
	melody = melody.slice(); // copy

	// console.log("Melody before", melody);

	for (let i = 0; i < swaps; i++) {
		let x = rng.int(melody.length - 1);
		let y = x + 1;

		let t = melody[x];
		melody[x] = melody[y];
		melody[y] = t;
	}

	let mutatedIndexes = [];

	for (let i = 0; i < mutations; i++) {
		let x, isNode, oldNode;

		do {
			x = rng.int(melody.length);
			oldNode = melody[x] - dHafltones;
			isNode = musicIsNode(oldNode);
		} while (!isNode || mutatedIndexes.indexOf(x) != -1);

		mutatedIndexes.push(x);

		let nodeIndex = melodyNodes.indexOf(oldNode);

		if (nodeIndex == 0) {
			nodeIndex++;
		} else if (nodeIndex == melodyNodes.length - 1) {
			nodeIndex--;
		} else {
			nodeIndex += rng.float() < 0.5 ? 1 : -1;
		}

		//nodeIndex = clamp(nodeIndex, 0, melodyNodes.length);

		melody[x] = melodyNodes[nodeIndex] + dHafltones;

		assert(musicIsNode(melody[x]));
	}

	// console.log("Melody after", melody);

	return melody;
}

function createMusic(level) {
	const rng = new RandomGenerator(376176 + (level + 1) * 9999);

	musicTempo = rng.float(4, 5);
	console.log("musicTempo", musicTempo);

	// Instruments

	instrumentList = [];
	for (const i of instrumentParamaters) {
		instrumentList.push(i.slice()); // copy array !
	}
	for (let i = 0; i < instrumentList.length; i++) {
		const instrument = instrumentList[i];
		mutateInstrumentParams(instrument, rng);
	}
	songData[0] = instrumentList;

	createInstruments();

	// prettier-ignore
	// let chordStarts = [
	// 	0, 0,
	// 	0, 0,
	// 	5, 5,
	// 	0, 0,
	// 	7, 5,
	// 	0, 0,
	// ];

	patterns = [[], []];

	//let chords = [0, 2, 4, 7, 9];

	let chords = [0, 5, 7]; // safe minor
	// let chords = [0, 3, 5, 7, 10]; // minor
	let chordStarts = [0, 0];
	for (let i = 0; i < 3; i++) {
		let c1 = chords[rng.int(chords.length)];
		chordStarts.push(c1, c1);

		// let c1 = chords[rng.int(chords.length)];
		// let c2 = chords[rng.int(chords.length)];

		// if (rng.int(2) < 1) {
		// 	chordStarts.push(c1, c1);
		// } else {
		// 	chordStarts.push(c1, c2);
		// }
	}

	// console.log(chordStarts);

	// Melody

	let melodyShift = [-2, -1, -1, 0, 0, 0, 0, 1, 1, 2];

	let lastNodeIndex = 5; // middle node

	let melodyRythm = [1, 0, rng.int(0, 2), rng.int(0, 2), 1, 0, rng.int(0, 2), rng.int(0, 2)];
	melodyRythm = createMutatedMelody(melodyRythm, 10, 0, rng);

	let melodyOffset = 24;

	let melody = [];
	for (let i = 0; i < chordStarts.length * 2 - 1; i++) {
		if (melodyRythm[i % melodyRythm.length]) {
			lastNodeIndex += melodyShift[rng.int(melodyShift.length)];
			lastNodeIndex = clamp(lastNodeIndex, 0, melodyNodes.length - 1);
			melody.push(melodyOffset + melodyNodes[lastNodeIndex]);
		} else {
			melody.push(undefined);
		}
	}
	melody.push(undefined); // last node always a pause

	let mutatedMelody = createMutatedMelody(melody, 5, 3, rng, melodyOffset);
	let mutatedMelody2 = createMutatedMelody(mutatedMelody, 5, 3, rng, melodyOffset);

	let reversedMutation = mutatedMelody.slice(); // copy
	reversedMutation.reverse();

	let fullMeleody = [3, 0];
	fullMeleody = fullMeleody.concat(melody);
	fullMeleody = fullMeleody.concat(mutatedMelody);
	fullMeleody = fullMeleody.concat(reversedMutation);
	fullMeleody = fullMeleody.concat(mutatedMelody2);
	patterns[0].push(fullMeleody);

	// Bass
	let randHit = () => (rng.float() < 0.5 ? undefined : 0);

	//let bassPattern = [0, 4, 7, 4, 0, 4, 7, 4];
	let bassPattern = [0, randHit(), randHit(), randHit(), 0, randHit(), randHit(), 12];

	let bassNodes = unfoldPattern(0, -0.1, 24, bassPattern, chordStarts);
	patterns[0].push(bassNodes);

	let bassNodes2 = unfoldPattern(0, 0.1, 24 + 7, bassPattern, chordStarts);
	patterns[0].push(bassNodes2);

	musicSongLength = bassNodes.length - 2;

	// Drums

	let bdStarts = Array(chordStarts.length).fill(0);
	let snareStarts = Array(chordStarts.length / 2).fill(0);

	let bdPattern = [0, undefined, randHit(), undefined, 0, undefined, randHit(), undefined];
	let snarePattern = [
		undefined,
		randHit(),
		0,
		randHit(),

		undefined,
		randHit(),
		0,
		randHit(),

		undefined,
		randHit(),
		0,
		randHit(),

		undefined,
		undefined,
		0,
		0,
	];

	patterns[0].push(unfoldPattern(1, 0, 7, bdPattern, bdStarts));
	patterns[0].push(unfoldPattern(2, 0.1, 7, snarePattern, snareStarts));
}

var vol = 0.2;
var musicOn = true;

var musicStartTime = 0;

function musicInit(level) {
	createMusic(level);
	musicStartTime = time;
	musicLastPlayedBeat = -1;
}

let musicLastPlayedBeat = -1;
let musicTempo = 5;

function musicUpdate() {
	let timeSinceStart = time - musicStartTime;

	if (timeSinceStart < 0) return;

	let beat = Math.floor(timeSinceStart * musicTempo) % musicSongLength;

	if (beat == musicLastPlayedBeat) return;

	player?.onNewBeat(beat);

	musicLastPlayedBeat = beat;

	if (!musicOn) return;

	//console.log("beat", beat);

	// crashes
	if (beat % (musicSongLength / 4) == 0) musicPlayCrash(beat == 0 ? 2.5 : 1);

	for (const pat of patterns[0]) {
		let instrument = instrumentList[pat[0]];
		let pan = pat[1];
		let semitone = pat[(beat % (pat.length - 2)) + 2];

		if (typeof semitone == "number" && !isNaN(semitone)) {
			// console.log("semi", semitone);

			//instrument.playNote(semitone - 12, vec2(cameraPos.x + pan, cameraPos.y), vol);
			instrument.playNotePure(semitone - 12, pan, vol);
		}
	}
}

function createInstruments() {
	for (let k in instrumentList) {
		instrumentList[k] = new Sound(instrumentList[k]);
	}
}

function musicPlayCrash(strength = 2) {
	instrumentList[4].playNotePure(12, 0, vol * strength);
}

/** @format */

class Player extends EngineObject {
	constructor(pos) {
		super(pos, vec2(0.6, 0.95), tile());

		this.hitWallTime = time;
		this.jumpTime = -1;

		this.drawSize = vec2(1.3);
		this.renderOrder = 10;
		this.walkCyclePercent = 0;
		this.alive = true;

		this.setCollision(true, true);

		this.lastBlockXTime = time;

		this.friction = 1;
		this.walkFrame = 0;

		this.forceJumpY = 0.3;
		this.forceWallJumpX = 0.15;

		this.maxXSpeed = 0.2;
		this.xAccelGround = 0.006;

		this.xSpeed = 0;

		this.jumpBreaked = false;

		this.jumpingOffScreen = false;
		this.doFlap = false;
		this.groundTime = -1; // last time we touched ground
	}

	jump(offWall = false) {
		this.doFlap = false;
		this.jumpTime = time;

		if (offWall) {
			this.velocity.x = sign(this.velocity.x) * this.forceWallJumpX;
			this.velocity.y = this.forceJumpY / 1.5;
		} else {
			sound_squark.play(this.pos, rand(0.5, 1));
			this.velocity.y = this.forceJumpY;
		}

		sound_jump.play(this.pos);

		this.hitWallTime = time - 1;

		let smokeXoffset = 0.45;
		let jumpSpot = this.pos.add(vec2(this.mirror ? smokeXoffset : -smokeXoffset, -0.45));

		makeSmoke(jumpSpot, 3);
	}

	jumpToNextLevel() {
		this.setCollision(false, false, false);

		let height = (levelSize.y - this.pos.y) / levelSize.y;

		this.forceJumpY = 0.15 + height / 4;

		this.velocity.x /= 2;
		this.jump();
		this.jumpingOffScreen = true;
		this.gravityScale = 0.1;
		this.angleDamping = 0.9;
		this.damping = 0.99;
		this.doFlap = false;
	}

	update() {
		if (gameState == GameState.GAME_OVER) return;

		if (!this.alive) {
			this.walkFrame = 0;
			this.velocity.x *= 0.9;
			this.angle = PI * 0.1 + this.angle * 0.9;
			return super.update();
		}

		this.angle = this.velocity.x / 2;

		if (this.jumpingOffScreen) {
			player.angle /= 2; // turn towards upwards
			super.update();
			return;
		}

		this.gravityScale = 1; // default gravity

		this.jumpButtonDown = inputJumpHeld();
		this.jumpButtonPressed = inputJumpPressed();
		this.jumpButtonReleased = inputJumpReleased();

		if (this.groundObject) {
			this.jumpTime = -1; // Not jumping
			this.jumpBreaked = false;
			this.groundTime = time;
			this.doFlap = false;

			this.velocity.y = 0;

			if (this.jumpButtonPressed) this.jump();

			// acceleration
			this.velocity.x += this.mirror ? -this.xAccelGround : this.xAccelGround;

			// update walk cycle
			const speed = this.velocity.length();
			this.walkCyclePercent += speed * 0.5;
			this.walkCyclePercent = speed > 0.01 ? mod(this.walkCyclePercent) : 0;
			this.walkFrame = (2 * this.walkCyclePercent) | 0;

			if (this.walkFrame != this.walkFrameLastFrame && this.walkFrame == 1) {
				sound_walk.play(this.pos, rand(0.5), rand(0.5, 1));
				makeSmoke(this.pos.add(vec2(0, -0.45)), rand(0.2));
			}

			this.walkFrameLastFrame = this.walkFrame;

			if (!this.onGroundLastFrame && this.velocityLastFrame.y < -0.1) {
				// Land
				let landingStrength = abs(this.velocityLastFrame.y) * 5;
				sound_dodge.play(this.pos, landingStrength);
				makeSmoke(this.pos.add(vec2(0, -0.5)));
			}
		} else {
			// If walked off a ledge
			if (this.jumpTime == -1) {
				let timeSinceGround = time - this.groundTime;

				const EXTRA_JUMPTIME = 0.1;
				if (timeSinceGround < EXTRA_JUMPTIME) {
					if (this.jumpButtonPressed) this.jump();
				} else {
					// convert to being in a jump (can flap, etc)
					this.jumpTime = time - EXTRA_JUMPTIME;
				}
			}

			// In a jump
			if (this.jumpTime > 0) {
				if (time - this.hitWallTime < 0.1) {
					if (this.jumpButtonDown) this.jump(true);
				}

				let timeInJump = time - this.jumpTime;

				if (this.jumpBreaked) {
					if (abs(this.velocity.x) > 0.1) this.velocity.x *= 0.96;
				} else {
					if (this.jumpButtonReleased) {
						sound_dodge.play(this.pos);

						// stop upwards movement
						if (this.velocity.y > 0) this.velocity.y = 0;

						this.gravityScale = 1.5;
						this.jumpBreaked = true;
					}
				}

				// Glide / flap
				if (timeInJump > 0.25) {
					if (this.jumpButtonPressed || this.doFlap) {
						sound_squark.play(this.pos, rand(0.5, 1));

						this.jumpTime = time;
						this.jumpBreaked = false;

						this.velocity.y = 0.12;

						this.velocity.x += this.mirror ? -0.2 : 0.2;

						this.gravityScale = 1;

						sound_dodge.play(this.pos);
						makeSmoke(this.pos);

						this.doFlap = false;
					}
				} else {
					if (timeInJump > 0.1 && this.jumpButtonPressed) this.doFlap = true;
				}
			}
		}

		this.velocity.x = clamp(this.velocity.x, -this.maxXSpeed, this.maxXSpeed);

		this.xSpeed = this.velocity.x;

		this.onGroundLastFrame = this.groundObject;
		this.jumpButtonDownLastFrame = this.jumpButtonDown;
		this.velocityLastFrame = this.velocity.copy();

		// this.speedMaxX = max(this.speedMaxX, abs(this.velocity.x));
		// this.speedMaxY = max(this.speedMaxY, abs(this.velocity.y));
		// console.log(this.speedMaxX, this.speedMaxY);

		super.update();
	}

	render() {}

	onNewBeat(beat) {
		if (this.jumpingOffScreen && beat % 2 == 0) this.doFlap = true;
	}

	renderTop() {
		let bodyPos = this.pos;
		bodyPos = bodyPos.add(vec2(0, (this.drawSize.y - this.size.y) / 6));

		if (this.jumpingOffScreen) {
			if (this.doFlap) {
				// FLAP !
				if (this.jumpBreaked) {
					this.tileInfo = spriteAtlas.playerWalk.frame(0);
					this.jumpBreaked = false; // Used for the flapping
				} else {
					this.tileInfo = spriteAtlas.playerJump;
					const flapForce = rand(0.1, 0.25);
					player.applyForce(vec2(player.mirror ? -flapForce : flapForce, flapForce / 2));
					player.angleVelocity += rand(-0.1, 0.1);

					sound_squark.play(this.pos, flapForce * 2, 0.9 + flapForce);
					this.jumpBreaked = true;
				}

				this.doFlap = false;
			}
		} else {
			if (!this.alive) {
				this.tileInfo = spriteAtlas.playerJump;
			} else {
				if (this.groundObject) {
					this.tileInfo = spriteAtlas.playerWalk.frame(this.walkFrame);

					// bounce pos with walk cycle
					bodyPos = bodyPos.add(vec2(0, 0.1 * Math.sin(this.walkCyclePercent * PI)));

					// make bottom flush
				} else {
					if (!this.jumpBreaked) {
						this.tileInfo = spriteAtlas.playerJump;
					} else {
						this.tileInfo = spriteAtlas.playerWalk.frame(0);
					}
				}
			}
		}

		if (gameState == GameState.GAME_OVER) {
			this.tileInfo = spriteAtlas.playerWalk.frame(0);
		}

		drawTile(bodyPos, this.drawSize, this.tileInfo, this.color, this.angle, this.mirror);
	}

	kill(resetTime = false) {
		if (!this.alive) return;

		sound_splat.play(this.pos);
		makeBlood(this.pos, 100);

		setTimeout(() => sound_squark.play(this.pos, 2, 0.8), 200);

		//sound_die.play(this.pos);

		this.alive = false;

		this.size = this.size.scale(0.5);
		this.angleDamping = 0.9;
		this.renderOrder = -1; // move to back layer

		this.setCollision(false, false);

		lives--;

		setTimeout(() => {
			if (lives == 0) {
				gameSetState(GameState.GAME_OVER);
				return;
			}

			levelSpawnPlayer();
			if (resetTime) levelStartTime = time;
		}, 1000);
	}

	onBlockedX() {
		if (time - this.lastBlockXTime < 0.1) return;
		this.lastBlockXTime = time;

		this.mirror = !this.mirror;
		this.velocity.x = -this.xSpeed / 3;

		this.hitWallTime = time;

		sound_dodge.play(this.pos);
		makeSmoke(this.pos.add(vec2(this.mirror ? 0.5 : -0.5, 0)));
	}

	collideWithTile(tile, pos) {
		if (tile == tileType_spike) {
			this.kill(true);
		}

		return true;
	}
}

/** @format */

function savefileGetHiscore() {
	return localStorage["dodo_hs"] | 0;
}

function savefileUpdateHiscore(score) {
	if (score > savefileGetHiscore()) {
		localStorage["dodo_hs"] = score;
		return true;
	}

	return false;
}

/** @format */

///////////////////////////////////////////////////////////////////////////////
// sky with background gradient, stars, and planets
class Sky extends EngineObject {
	constructor() {
		super();

		this.renderOrder = -1e4;
		this.seed = randInt(1e9);
		// this.skyColor = new Color().setHex("#b7fffe"); //  rgb(0, 0, 0.2); //  hsl(0, 0, 0.1);
		// this.horizonColor = new Color().setHex("#3c71e4"); //rgb(0, 0, 0); //this.skyColor.subtract(hsl(0, 0, 0.05, 0)); //.mutate(0.3);

		this.skyColor = rgb(0, 0, 0.3);
		this.horizonColor = rgb(0.2, 0.0, 0.0);
	}

	render() {
		// fill background with a gradient
		const gradient = mainContext.createLinearGradient(0, 0, 0, mainCanvas.height);
		// @ts-ignore
		gradient.addColorStop(0, this.skyColor);
		// @ts-ignore
		gradient.addColorStop(1, this.horizonColor);
		mainContext.save();
		mainContext.fillStyle = gradient;
		mainContext.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
		mainContext.globalCompositeOperation = "lighter";

		// draw stars
		const random = new RandomGenerator(this.seed);
		for (let i = 100 + Math.floor((mainCanvas.width * mainCanvas.height) / 1500); i--; ) {
			const size = random.float(0.5, 2) ** 2;
			const speed = random.float() < 0.95 ? random.float(-3, 3) : random.float(-99, 99);
			const color = hsl(random.float(-0.3, 0.2), random.float(), random.float());
			const extraSpace = 50;
			const w = mainCanvas.width + 2 * extraSpace,
				h = mainCanvas.height + 2 * extraSpace;

			let camMult = size * 3;

			const screenPos = vec2(
				mod(random.float(w) + time * speed - cameraPos.x * camMult, w) - extraSpace,
				mod(random.float(h) + time * speed * random.float() + cameraPos.y * camMult, h) - extraSpace
			);
			// @ts-ignore
			mainContext.fillStyle = color;
			mainContext.fillRect(screenPos.x, screenPos.y, size, size);
		}
		mainContext.restore();
	}
}

// THIS FILE IS GENERATED BY THE GRUNT BUILD SCRIPT
let levelData = [
{ w: 32, h: 20, d: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,7,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,3,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,1,1,1,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0]}, 
{ w: 19, h: 17, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,7,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,6,6,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,6,6,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,6,6,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 29, h: 20, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,3,0,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,0,0,0,6,6,6,6,0,0,0,6,6,6,6,0,0,0,6,6,6,6,6,6,0,0,0,0,0,6,0,1,0,6,9,9,6,0,1,0,6,9,9,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,9,9,6,0,1,0,6,9,9,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,9,9,6,0,1,0,6,9,9,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,9,9,6,0,1,0,6,9,9,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,9,9,6,0,1,0,6,9,9,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,9,9,6,0,1,0,6,9,9,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,9,9,6,0,1,0,6,9,9,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,9,9,6,0,1,0,6,9,9,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,9,9,6,0,1,0,6,9,9,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,9,9,6,0,1,0,6,9,9,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,0,0,6,6,6,6,0,0,0,6,6,6,6,0,0,0,6,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 27, h: 17, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 30, h: 20, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,6,6,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,1,0,6,6,0,0,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,1,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,6,6,0,1,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,0,0,0,0,6,6,0,1,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,1,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,1,0,6,6,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,1,0,6,6,0,0,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,1,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,1,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,1,0,6,6,0,0,0,3,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,6,6,0,1,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,0,1,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,0,1,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 29, h: 21, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,6,6,3,0,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,6,6,0,0,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,6,6,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,6,6,0,0,0,0,0,0,6,8,8,8,8,8,8,8,8,8,8,8,8,8,6,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 20, h: 17, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,6,6,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,6,6,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,6,6,0,7,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,8,8,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 29, h: 20, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,6,6,0,0,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,1,1,1,0,0,0,0,0,0,0,7,0,0,0,0,0,0,0,1,1,1,0,0,0,6,6,0,0,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,6,6,8,8,8,8,8,8,8,8,8,8,6,6,6,6,6,6,6,8,8,8,8,8,8,8,8,8,8,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 29, h: 20, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,0,0,0,6,6,6,6,0,0,0,6,6,6,6,0,0,0,6,6,6,6,6,6,0,0,0,0,0,6,0,1,0,6,6,6,6,0,1,0,6,6,6,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,6,6,6,0,1,0,6,6,6,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,6,6,6,0,1,0,6,6,6,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,6,6,6,0,1,0,6,6,6,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,6,6,6,0,1,0,6,6,6,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,6,6,6,0,1,0,6,6,6,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,6,6,6,0,1,0,6,6,6,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,6,6,6,0,1,0,6,6,6,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,1,0,6,6,6,6,0,1,0,6,6,6,6,0,1,0,6,0,0,0,0,0,0,0,0,0,0,6,0,0,0,6,6,6,6,0,0,0,6,6,6,6,0,0,0,6,0,0,0,0,0,0,0,0,0,0,6,0,0,0,6,6,6,6,0,0,0,6,6,6,6,0,0,0,6,0,0,0,0,0,0,0,0,0,0,6,0,0,0,6,6,6,6,0,0,0,6,6,6,6,0,0,0,6,0,0,0,0,0,0,0,0,0,0,6,8,8,8,6,6,6,6,8,8,8,6,6,6,6,8,8,8,6,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 29, h: 20, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,9,9,9,6,9,6,6,6,9,9,9,6,9,9,9,6,6,9,6,6,6,6,6,6,6,6,6,6,6,9,6,6,6,9,6,6,6,9,6,9,6,9,6,9,6,6,9,6,6,6,6,6,6,6,6,6,6,6,9,9,6,6,9,6,6,6,9,9,9,6,9,9,9,6,6,9,6,6,6,6,6,6,6,6,6,6,6,9,6,6,6,9,6,6,6,9,6,9,6,9,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,9,6,6,6,9,9,9,6,9,6,9,6,9,6,6,6,6,9,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,1,1,1,0,1,1,1,0,0,0,6,6,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 29, h: 20, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,9,9,9,9,9,9,0,0,6,6,0,0,6,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,9,9,9,9,9,9,9,0,0,6,6,0,0,6,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,9,9,0,0,0,9,9,0,0,6,6,0,0,6,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,9,9,0,1,0,9,9,0,0,6,6,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,9,0,1,0,9,9,0,0,6,6,0,0,6,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,9,9,0,1,0,9,9,0,0,6,6,0,0,6,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,9,9,0,1,0,9,9,0,0,6,6,0,0,6,1,1,1,0,1,1,1,1,1,0,0,0,0,0,0,9,9,0,1,0,9,9,0,0,6,6,0,0,6,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0,9,9,0,1,0,9,9,0,0,6,6,0,0,6,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,9,9,0,1,0,9,9,0,0,6,6,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,9,0,1,0,9,9,0,0,6,6,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,9,0,1,0,9,9,0,0,6,6,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,9,0,1,0,9,9,0,0,6,6,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,9,9,0,0,0,9,9,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 29, h: 20, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,3,0,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 29, h: 20, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,3,0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,6,6,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,6,6,0,0,6,6,6,6,6,6,6,6,6,0,0,0,0,0,6,6,6,6,6,6,6,6,6,0,0,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,0,0,6,6,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,6,6,0,0,6,6,0,0,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,0,0,6,6,0,0,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,0,0,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 31, h: 20, d: [6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,6,6,0,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,6,6,0,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,6,6,3,0,6,6,6,6,6,6,6,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,9,9,9,9,9,9,9,9,9,9,6,8,8,8,8,8,8,8,6,9,9,9,9,9,9,9,9,9,9,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
{ w: 29, h: 18, d: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,8,8,8,8,8,8,8,8,8,8,8,8,8,0,0,0,0,0,0,0,0,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6]}, 
]; 

const IS_RELEASE = true;

/** @format */

const ROCKET_MAX_SIZE = 3;

class VictoryRocket extends EngineObject {
	static gravity = 10;
	static liveRockets = new Set();

	static destroyAllLive() {
		for (const i of VictoryRocket.liveRockets) {
			i.destroy();
		}

		VictoryRocket.liveRockets = new Set();
	}

	static spawnRandom() {
		const MAX_ROCKETS = 5;

		if (VictoryRocket.liveRockets.size >= MAX_ROCKETS) return;

		let rocketsPercentage = VictoryRocket.liveRockets.size / MAX_ROCKETS;

		if (rand() * rocketsPercentage * 20 < Math.sin(time) * Math.cos(time / 2.123)) {
			new VictoryRocket();
		}
	}

	constructor() {
		super(vec2(rand(mainCanvas.width * 1.2), mainCanvas.height), vec2(4, 20), undefined, 0, Colors.grey, 100000);

		this.setCollision(false, false, false);

		let speed = mainCanvas.height / 75;

		VictoryRocket.gravity = mainCanvas.height / 10000;

		let speedRand = rand(0.8, 1.2);

		this.velocity = vec2(rand(-1, 1), -speed * speedRand);
		this.explodeTime = time + rand(1, 2);

		VictoryRocket.liveRockets.add(this);

		this.renderOrder = -1000;

		this.rocketSize = rand(1, ROCKET_MAX_SIZE);

		sound_rocketFly.play(this.pos, this.rocketSize / 10, 2 * speedRand);
	}

	update() {
		// gravity
		this.velocity.y += VictoryRocket.gravity;

		this.pos = this.pos.add(this.velocity);

		this.angle = -this.velocity.angle();

		if (time > this.explodeTime) {
			VictoryRocket.liveRockets.delete(this);

			this.destroy();

			let explosionColor = hsl(rand(1), 1, 0.5);

			gameBlinkFrames += this.rocketSize * 4;

			setTimeout(() => {
				gameCameraShake(this.rocketSize - 1);
				sound_explosion.play(this.pos, this.rocketSize / ROCKET_MAX_SIZE);
			}, 1000 / this.rocketSize);

			let emitRate = this.rocketSize * 100 * rand(0.5, 1.5);
			let particleTime = this.rocketSize * 2 * rand(0.5, 1.5);
			let sizeStart = this.rocketSize * 0.2 * rand(0.5, 1.5);
			let sizeEnd = 0.0;
			let particleSpeed = rand(0.08, 0.15) * this.rocketSize;
			let particleAngleSpeed = rand(0.1, 0.5);
			let fadeRate = rand(0.1, 0.2);
			let randomness = rand(0.2, 0.5);
			let damping = (9 + this.rocketSize / ROCKET_MAX_SIZE) / 10;
			let dampingTrails = damping; // * 0.99;

			let gravityScale = rand(0.005, 0.2);

			let particles = new ParticleEmitter(
				screenToWorld(this.pos), // pos
				0, // angle
				0, // emitSize
				0.2, // emitTime
				emitRate, // emitRate
				PI * 2, // emiteConeAngle
				undefined, // tileIndex
				Colors.white, // colorStartA
				explosionColor, // colorStartB
				explosionColor, // colorEndA
				explosionColor, // colorEndB
				particleTime, // particleTime
				sizeStart, // sizeStart
				sizeEnd, // sizeEnd
				particleSpeed, // particleSpeed
				particleAngleSpeed, // particleAngleSpeed
				damping, // damping
				1, // angleDamping
				gravityScale, // gravityScale
				PI, // particleCone
				fadeRate, //fadeRate,
				randomness, // randomness
				false, // collide
				false, // additive
				true, // randomColorLinear
				this.renderOrder // renderOrder
			);

			let trails = new ParticleEmitter(
				screenToWorld(this.pos), // pos
				0, // angle
				0, // emitSize
				0.2, // emitTime
				emitRate, // emitRate
				PI * 2, // emiteConeAngle
				undefined, // tileIndex
				explosionColor, // colorStartA
				Colors.white, // colorStartB
				Colors.black, // colorEndA
				Colors.black, // colorEndB
				particleTime / 2, // particleTime
				sizeStart / 5, // sizeStart
				sizeEnd / 5, // sizeEnd
				particleSpeed, // particleSpeed
				particleAngleSpeed, // particleAngleSpeed
				dampingTrails, // damping
				1, // angleDamping
				gravityScale, // gravityScale
				PI, // particleCone
				fadeRate, //fadeRate,
				randomness, // randomness
				false, // collide
				false, // additive
				true, // randomColorLinear
				this.renderOrder // renderOrder
			);

			trails.trailScale = rand(5, 15);

			let explosion = new ParticleEmitter(
				screenToWorld(this.pos), // pos
				0, // angle
				1, // emitSize
				0.1, // emitTime
				200, // emitRate
				PI * 2, // emiteConeAngle
				undefined, // tileIndex
				Colors.white, // colorStartA
				Colors.white, // colorStartB
				Colors.white, // colorEndA
				Colors.white, // colorEndB
				0.25, // particleTime
				this.rocketSize, // sizeStart
				0, // sizeEnd
				0.001, // particleSpeed
				0.1, // particleAngleSpeed
				0.99, // damping
				1, // angleDamping
				0, // gravityScale
				PI, // particleCone
				0.9, //fadeRate,
				0.1, // randomness
				false, // collide
				false, // additive
				true, // randomColorLinear
				this.renderOrder // renderOrder
			);
		}
	}

	render() {
		drawRect(screenToWorld(this.pos), this.size.scale(0.04), this.color, this.angle, true);
	}
}
