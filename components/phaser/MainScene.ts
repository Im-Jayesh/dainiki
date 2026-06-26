import Phaser from 'phaser';
import { EventBus } from './EventBus';

class Fish extends Phaser.Physics.Arcade.Sprite {
    target: Phaser.Math.Vector2;
    swimSpeed: number = 20 + Math.random() * 20;
    baseSwimSpeed: number;
    bubbles: Phaser.GameObjects.Particles.ParticleEmitter;

    constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
        super(scene, x, y, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.setAlpha(0);
        scene.tweens.add({
            targets: this,
            alpha: 0.8,
            duration: 2000
        });

        this.setScale(0.12 + Math.random() * 0.08);
        this.target = new Phaser.Math.Vector2(x, y);
        this.baseSwimSpeed = this.swimSpeed;
        this.setNewTarget();

        scene.tweens.add({
            targets: this,
            y: this.y + (Math.random() > 0.5 ? 3 : -3),
            duration: 2000 + Math.random() * 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.bubbles = scene.add.particles(0, 0, 'bubble', {
            speed: { min: -10, max: 10 },
            angle: { min: 250, max: 290 },
            scale: { start: 0.1, end: 0 },
            alpha: { start: 0.4, end: 0 },
            lifespan: 2000,
            frequency: 1000 + Math.random() * 1000
        });
        this.bubbles.startFollow(this);

        this.setInteractive({ useHandCursor: true });
        this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.leftButtonDown()) {
                const mainScene = this.scene as MainScene;
                mainScene.createRipple(this.x, this.y);
                mainScene.createSplash(this.x, this.y);

                this.swimSpeed = 150;
                this.setNewTarget();

                scene.time.delayedCall(2000, () => {
                    this.swimSpeed = this.baseSwimSpeed;
                });
            }
        });
    }

    setNewTarget() {
        if (!this.scene) return;
        const { width, height } = this.scene.scale;
        const padding = 100;
        this.target.set(
            Phaser.Math.Between(padding, width - padding),
            Phaser.Math.Between(padding, height - padding)
        );

        this.scene.time.delayedCall(Phaser.Math.Between(5000, 15000), () => {
            if (this.scene) this.setNewTarget();
        });
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        const distance = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);

        if (distance > 10 && this.body) {
            this.scene.physics.moveToObject(this, this.target, this.swimSpeed);

            if (this.body.velocity.x < 0) {
                this.setFlipX(true);
            } else if (this.body.velocity.x > 0) {
                this.setFlipX(false);
            }

            const tilt = (this.body.velocity.y * 0.05);
            this.setAngle(tilt);
        } else if (this.body) {
            this.body.stop();
        }
    }
}

export class MainScene extends Phaser.Scene {
    bg!: Phaser.GameObjects.Image;
    fishGroup!: Phaser.GameObjects.Group;
    liliesGroup!: Phaser.GameObjects.Group;
    lilyData: any[] = [];
    floatingBottle: Phaser.GameObjects.Sprite | null = null;
    floatingTween: Phaser.Tweens.Tween | null = null;

    constructor() {
        super('MainScene');
    }

    preload() {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.lineStyle(2, 0xffffff, 0.8);
        graphics.strokeCircle(5, 5, 5);
        graphics.generateTexture('bubble', 10, 10);
        graphics.destroy();

        const rGraphics = this.make.graphics({ x: 0, y: 0 });
        rGraphics.lineStyle(4, 0xffffff, 0.6);
        rGraphics.strokeCircle(50, 50, 48);
        rGraphics.generateTexture('ripple', 100, 100);
        rGraphics.destroy();

        const sGraphics = this.make.graphics({ x: 0, y: 0 });
        sGraphics.fillStyle(0xffffff, 0.8);
        sGraphics.fillCircle(4, 4, 4);
        sGraphics.generateTexture('splash_particle', 8, 8);
        sGraphics.destroy();

        this.load.image('pond_dark', '/pond-assets/ponds/rectpond-stage-1.png');
        this.load.image('pond_light', '/pond-assets/ponds/day-time-pond.png');
        this.load.image('fish1', '/pond-assets/ponds/fish-1.png');
        this.load.image('fish2', '/pond-assets/ponds/fish-2.png');
        for (let i = 1; i <= 8; i++) {
            this.load.image(`lily${i}`, `/pond-assets/lily/lily-stage-${i}.png`);
        }
        this.load.image('bottle', '/bottle.png');
    }

    create() {
        const isDark = document.documentElement.classList.contains('dark');

        this.bg = this.add.image(this.scale.width / 2, this.scale.height / 2, isDark ? 'pond_dark' : 'pond_light');
        this.updateBackgroundScale();
        this.scale.on('resize', () => {
            this.updateBackgroundScale();
            this.repositionLilies();
        }, this);

        this.fishGroup = this.add.group();
        for (let i = 0; i < 6; i++) {
            const x = Phaser.Math.Between(100, this.scale.width - 100);
            const y = Phaser.Math.Between(100, this.scale.height - 100);
            const type = Math.random() > 0.5 ? 'fish1' : 'fish2';
            const fish = new Fish(this, x, y, type);
            this.fishGroup.add(fish);
        }

        this.liliesGroup = this.add.group();

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.leftButtonDown()) {
                const hitObjects = this.input.hitTestPointer(pointer);
                if (hitObjects.length === 0) {
                    this.createRipple(pointer.x, pointer.y);
                }
            }
        });

        const onThemeChanged = (dark: boolean) => {
            if (!this.sys) return;
            if (this.bg) this.bg.setTexture(dark ? 'pond_dark' : 'pond_light');
        };
        EventBus.on('theme-changed', onThemeChanged);

        const onSpawnLilies = (data: any[]) => {
            if (!this.sys) return;
            this.lilyData = data;
            this.repositionLilies();
        };
        EventBus.on('spawn-lilies', onSpawnLilies);

        const onReceiveEcho = (echoData: any) => {
            if (!this.sys) return;
            if (this.floatingBottle) this.floatingBottle.destroy();
            const x = Phaser.Math.Between(100, this.scale.width - 100);
            const y = Phaser.Math.Between(100, this.scale.height - 100);
            this.floatingBottle = this.add.sprite(x, y, 'bottle');
            this.floatingBottle.setScale(0.5);
            this.floatingBottle.setInteractive({ useHandCursor: true });
            this.floatingBottle.on('pointerdown', () => EventBus.emit('open-echo', echoData));

            this.floatingTween = this.tweens.add({
                targets: this.floatingBottle,
                y: y - 15,
                angle: { from: -5, to: 5 },
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            const glow = this.add.particles(0, 0, 'bubble', {
                scale: { start: 2, end: 4 },
                alpha: { start: 0.2, end: 0 },
                lifespan: 1000,
                frequency: 500,
                tint: 0x3b82f6
            });
            glow.startFollow(this.floatingBottle);
            this.floatingBottle.setData('glow', glow);
        };
        EventBus.on('receive-echo', onReceiveEcho);

        const onClearEcho = () => {
            if (!this.sys) return;
            if (this.floatingBottle) {
                const glow = this.floatingBottle.getData('glow');
                if (glow) glow.destroy();
                this.floatingBottle.destroy();
                this.floatingBottle = null;
            }
        };
        EventBus.on('clear-echo', onClearEcho);

        const onCastEcho = () => {
            if (!this.sys) return;
            const x = this.scale.width / 2;
            const y = this.scale.height / 2;
            const bottle = this.add.sprite(x, -50, 'bottle');
            bottle.setScale(0.5);

            this.tweens.add({
                targets: bottle,
                y: y,
                angle: 10,
                duration: 800,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    this.createMassiveRipple(x, y);
                    this.createSplash(x, y);
                    const bubbles = this.add.particles(x, y, 'bubble', {
                        speedY: { min: -20, max: -50 },
                        speedX: { min: -10, max: 10 },
                        scale: { start: 0.5, end: 0 },
                        alpha: { start: 0.8, end: 0 },
                        lifespan: 1500,
                        frequency: 100
                    });

                    this.tweens.add({
                        targets: bottle,
                        y: y + 50,
                        scale: 0,
                        alpha: 0,
                        duration: 2000,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            bottle.destroy();
                            this.time.delayedCall(1500, () => bubbles.destroy());
                            EventBus.emit('cast-complete');
                        }
                    });
                }
            });
        };
        EventBus.on('cast-echo', onCastEcho);

        const onTossCoin = () => {
            if (!this.sys) return;
            const x = this.scale.width / 2;
            const y = this.scale.height / 2;
            const coin = this.add.circle(x, -20, 10, 0xfbbf24);

            this.tweens.add({
                targets: coin,
                y: y,
                scaleX: { from: 1, to: 0.1, yoyo: true, repeat: 4 },
                duration: 1000,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    this.createMassiveRipple(x, y);
                    this.createSplash(x, y);
                    const bubbles = this.add.particles(x, y, 'bubble', {
                        speedY: { min: -20, max: -50 },
                        speedX: { min: -10, max: 10 },
                        scale: { start: 0.4, end: 0 },
                        alpha: { start: 0.6, end: 0 },
                        lifespan: 1200,
                        frequency: 100
                    });

                    this.tweens.add({
                        targets: coin,
                        y: y + 30,
                        scale: 0,
                        alpha: 0,
                        duration: 1500,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            coin.destroy();
                            this.time.delayedCall(1200, () => bubbles.destroy());
                            EventBus.emit('coin-landed');
                        }
                    });
                }
            });
        };
        EventBus.on('toss-coin', onTossCoin);

        const cleanup = () => {
            EventBus.off('theme-changed', onThemeChanged);
            EventBus.off('spawn-lilies', onSpawnLilies);
            EventBus.off('receive-echo', onReceiveEcho);
            EventBus.off('clear-echo', onClearEcho);
            EventBus.off('cast-echo', onCastEcho);
            EventBus.off('toss-coin', onTossCoin);
        };

        this.events.once('shutdown', cleanup);
        this.events.once('destroy', cleanup);

        EventBus.emit('current-scene-ready', this);
    }

    updateBackgroundScale() {
        if (!this.bg) return;
        const { width, height } = this.scale;
        this.bg.setPosition(width / 2, height / 2);
        const scale = Math.max(width / this.bg.width, height / this.bg.height);
        this.bg.setScale(scale);
    }

    repositionLilies() {
        this.liliesGroup.clear(true, true);
        const isMobile = this.scale.width < 768;
        const mobileScaleMultiplier = isMobile ? 1.4 : 1.0;

        this.lilyData.forEach(lily => {
            const x = (parseFloat(lily.left) / 100) * this.scale.width;
            const y = (parseFloat(lily.top) / 100) * this.scale.height;
            const sprite = this.add.sprite(x, y, `lily${lily.stage}`);

            const finalScale = lily.scale * mobileScaleMultiplier;
            sprite.setScale(finalScale);
            sprite.setAlpha(0.9);
            this.liliesGroup.add(sprite);

            const sway = this.tweens.add({
                targets: sprite,
                scaleX: finalScale * 1.05,
                scaleY: finalScale * 1.05,
                angle: { from: -2, to: 2 },
                duration: 3000 + Math.random() * 2000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: Math.random() * 1000
            });

            sprite.setInteractive({ useHandCursor: true });

            sprite.on('pointerover', () => {
                sway.setTimeScale(4);
                sprite.setTint(0xccffcc);

                // Magical "coin-like" glow behind the lily
                const glow = this.add.particles(x, y, 'bubble', {
                    scale: { start: finalScale * 1.5, end: finalScale * 5 },
                    alpha: { start: 0.4, end: 0 },
                    lifespan: 1500,
                    speed: 0,
                    quantity: 1,
                    frequency: 250,
                    blendMode: 'ADD',
                    tint: 0xffffcc
                });
                glow.setDepth(sprite.depth - 1);
                sprite.setData('hoverGlow', glow);
            });

            sprite.on('pointerout', () => {
                sway.setTimeScale(1);
                sprite.clearTint();
                const glow = sprite.getData('hoverGlow');
                if (glow) glow.destroy();
            });
        });
    }

    createRipple(x: number, y: number) {
        const ripple = this.add.sprite(x, y, 'ripple');
        ripple.setScale(0);
        ripple.setAlpha(0.5);
        this.tweens.add({
            targets: ripple,
            scale: 2,
            alpha: 0,
            duration: 1500,
            ease: 'Cubic.easeOut',
            onComplete: () => ripple.destroy()
        });
    }

    createSplash(x: number, y: number) {
        // Gentle splash spreading in all directions
        const emitter = this.add.particles(x, y, 'splash_particle', {
            speed: { min: 20, max: 60 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.5, end: 0 },
            alpha: { start: 0.6, end: 0 },
            lifespan: 1200,
            gravityY: 100,
            quantity: 15,
            blendMode: 'ADD'
        });
        this.time.delayedCall(1200, () => emitter.destroy());
    }

    createMassiveRipple(x: number, y: number) {
        for (let i = 0; i < 3; i++) {
            this.time.delayedCall(i * 300, () => {
                const ripple = this.add.sprite(x, y, 'ripple');
                ripple.setScale(0).setAlpha(0.8);
                this.tweens.add({
                    targets: ripple,
                    scale: 5,
                    alpha: 0,
                    duration: 3000,
                    ease: 'Sine.easeOut',
                    onComplete: () => ripple.destroy()
                });
            });
        }
    }
}
