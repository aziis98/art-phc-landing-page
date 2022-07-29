type Point2i = [number, number]

type WireDirection = 'down-left' | 'down' | 'down-right'

type TipPosition = false | 'begin' | 'end' | 'begin-end'

type WirePiece = {
    direction: WireDirection
    lerp: number
    tipPosition: TipPosition
}

type LatticePoint = string

function toLatticePoint(x: number, y: number): LatticePoint {
    return `${x | 0},${y | 0}`
}

function fromLatticePoint(p: LatticePoint): Point2i {
    const [x, y] = p.split(',').map(s => parseInt(s))
    return [x, y]
}

type WireNode = { point: Point2i; direction: WireDirection }

type Wire = WireNode[]

type World = {
    dimensions: Point2i

    wirePieces: { [point: LatticePoint]: WirePiece }
    wiresQueue: { wire: Wire; cursor: number }[]
}

function randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]
}

const randomDirection = (): WireDirection => randomChoice(['down', 'down-left', 'down-right'])

const nextPoint = ([x, y]: [number, number], direction: WireDirection): [number, number] => {
    if (direction === 'down') return [x, y + 1]
    if (direction === 'down-left') return [x - 1, y + 1]
    if (direction === 'down-right') return [x + 1, y + 1]
    throw 'invalid'
}

function checkPoint(world: World, [x, y]: [number, number]): boolean {
    return !!world.wirePieces[toLatticePoint(x, y)]
}

function wireIntersects(world: World, wire: Wire): boolean {
    return wire.some(({ point: [x, y], direction }) => {
        // TODO: The point check actually "doubly" depends on direction
        if (direction === 'down') {
            return checkPoint(world, [x, y]) || checkPoint(world, [x, y + 1])
        }
        if (direction === 'down-left') {
            return checkPoint(world, [x, y]) || checkPoint(world, [x - 1, y])
        }
        if (direction === 'down-right') {
            return checkPoint(world, [x, y]) || checkPoint(world, [x + 1, y])
        }
        return false
    })
}

function generateWire(world: World): Wire {
    const [w, h] = world.dimensions

    const randomPoint = (): [number, number] => [
        Math.floor(Math.random() * w),
        Math.floor(Math.pow(Math.random(), 2) * h * 0.5),
    ]

    const wireLength = 3 + Math.floor(Math.random() * 12)
    const wire: Wire = [
        {
            point: randomPoint(),
            direction: randomDirection(),
        },
    ]

    let prev = wire[0]
    let dir = prev.direction

    for (let i = 0; i < wireLength; i++) {
        const p = nextPoint(prev.point, dir)

        if (Math.random() < 0.35) {
            // change direction
            if (dir === 'down') {
                dir = randomChoice(['down-left', 'down-right'])
            } else {
                dir = 'down'
            }
        }

        wire.push({
            point: p,
            direction: dir,
        })
        prev = wire[wire.length - 1]
    }

    return wire
}

class Art {
    static CELL_SIZE = 24
    static TIP_RADIUS = 4
    static WIRE_LERP_SPEED = 50 // units / seconds

    renewGraphicsContext: boolean = true
    dirty: boolean

    world: World

    constructor($canvas: HTMLCanvasElement) {
        let g: CanvasRenderingContext2D

        let unMount = this.setup($canvas)

        window.addEventListener('resize', () => {
            this.renewGraphicsContext = true
            unMount()
            unMount = this.setup($canvas)
        })

        const renderFn = () => {
            if (this.renewGraphicsContext) {
                $canvas.width = $canvas.offsetWidth * devicePixelRatio
                $canvas.height = $canvas.offsetHeight * devicePixelRatio

                g = $canvas.getContext('2d')!
                g.scale(devicePixelRatio, devicePixelRatio)
            }

            if (this.dirty || this.renewGraphicsContext) {
                console.log('Rendering')
                this.render(g, $canvas.offsetWidth, $canvas.offsetHeight)
            }

            this.dirty = false
            this.renewGraphicsContext = false
            requestAnimationFrame(renderFn)
        }

        renderFn()
    }

    setup($canvas: HTMLCanvasElement) {
        this.world = {
            dimensions: [
                Math.ceil($canvas.offsetWidth / Art.CELL_SIZE),
                Math.ceil($canvas.offsetHeight / Art.CELL_SIZE),
            ],
            wirePieces: {},
            wiresQueue: [],
        }

        let failedTries = 0

        const wireGeneratorTimer = setInterval(() => {
            if (this.world.wiresQueue.length > 0) {
                return
            }

            console.log('Trying to generate wire')
            if (failedTries > 200) {
                console.log('Stopped generating wires')
                clearInterval(wireGeneratorTimer)
                return
            }

            const wire = generateWire(this.world)
            if (!wireIntersects(this.world, wire)) {
                failedTries = 0
                this.world.wiresQueue.push({ wire, cursor: 0 })
            } else {
                failedTries++
            }
        }, 10)

        let pieceLerpBeginTime = new Date().getTime()
        const wireQueueTimer = setInterval(() => {
            if (this.world.wiresQueue.length > 0) {
                console.log('Interpolating queued wire')

                // get top wire to add
                const wireInterp = this.world.wiresQueue[0]
                if (wireInterp.cursor < wireInterp.wire.length) {
                    const currentNode = wireInterp.wire[wireInterp.cursor]
                    const pieceLerpEndTime = pieceLerpBeginTime + 1000 / Art.WIRE_LERP_SPEED

                    const now = new Date().getTime()
                    if (now > pieceLerpEndTime) {
                        wireInterp.cursor++
                        pieceLerpBeginTime = new Date().getTime()

                        this.world.wirePieces[toLatticePoint(...currentNode.point)] = {
                            direction: currentNode.direction,
                            lerp: 1,
                            tipPosition:
                                wireInterp.cursor === 1
                                    ? 'begin'
                                    : wireInterp.cursor === wireInterp.wire.length && 'end',
                        }

                        this.dirty = true
                        return
                    }

                    const lerp = ((now - pieceLerpBeginTime) / 1000) * Art.WIRE_LERP_SPEED
                    this.world.wirePieces[toLatticePoint(...currentNode.point)] = {
                        ...currentNode,
                        tipPosition: wireInterp.cursor === 0 ? 'begin-end' : 'end',
                        lerp,
                    }

                    this.dirty = true
                } else {
                    this.world.wiresQueue.splice(0, 1)
                }
            }
        }, 1000 / 60)

        const unMount = () => {
            clearInterval(wireGeneratorTimer)
            clearInterval(wireQueueTimer)
        }

        document.addEventListener('keypress', e => {
            if (e.key === 'r') {
                unMount()
                this.setup($canvas)
            }
        })

        return unMount
    }

    render(g: CanvasRenderingContext2D, width: number, height: number) {
        g.clearRect(0, 0, width, height)

        // Grid
        // g.lineWidth = 1
        // g.strokeStyle = '#ddd'
        // g.beginPath()
        // for (let i = 0; i < height / Art.CELL_SIZE; i++) {
        //     g.moveTo(0, i * Art.CELL_SIZE)
        //     g.lineTo(width, i * Art.CELL_SIZE)
        // }
        // for (let j = 0; j < width / Art.CELL_SIZE; j++) {
        //     g.moveTo(j * Art.CELL_SIZE, 0)
        //     g.lineTo(j * Art.CELL_SIZE, height)
        // }
        // g.stroke()

        g.lineWidth = 3
        g.strokeStyle = '#c8c8c8'
        g.lineCap = 'round'
        g.lineJoin = 'round'

        for (const [lp, piece] of Object.entries(this.world.wirePieces)) {
            const [x, y] = fromLatticePoint(lp)
            g.beginPath()
            g.moveTo(x * Art.CELL_SIZE, y * Art.CELL_SIZE)
            switch (piece.direction) {
                case 'down-left':
                    g.lineTo((x - piece.lerp) * Art.CELL_SIZE, (y + piece.lerp) * Art.CELL_SIZE)
                    break
                case 'down':
                    g.lineTo(x * Art.CELL_SIZE, (y + piece.lerp) * Art.CELL_SIZE)
                    break
                case 'down-right':
                    g.lineTo((x + piece.lerp) * Art.CELL_SIZE, (y + piece.lerp) * Art.CELL_SIZE)
                    break
            }
            g.stroke()
        }

        for (const [lp, piece] of Object.entries(this.world.wirePieces)) {
            const [x, y] = fromLatticePoint(lp)
            const drawTip = () => {
                if (
                    y !== 0 &&
                    (piece.tipPosition === 'begin' || piece.tipPosition === 'begin-end')
                ) {
                    switch (piece.direction) {
                        case 'down-left':
                            {
                                const cx = x * Art.CELL_SIZE
                                const cy = y * Art.CELL_SIZE
                                g.ellipse(cx, cy, Art.TIP_RADIUS, Art.TIP_RADIUS, 0, 0, 2 * Math.PI)
                            }
                            break
                        case 'down':
                            {
                                const cx = x * Art.CELL_SIZE
                                const cy = y * Art.CELL_SIZE
                                g.ellipse(cx, cy, Art.TIP_RADIUS, Art.TIP_RADIUS, 0, 0, 2 * Math.PI)
                            }
                            break
                        case 'down-right':
                            {
                                const cx = x * Art.CELL_SIZE
                                const cy = y * Art.CELL_SIZE
                                g.ellipse(cx, cy, Art.TIP_RADIUS, Art.TIP_RADIUS, 0, 0, 2 * Math.PI)
                            }
                            break
                    }
                }
                if (piece.tipPosition === 'end' || piece.tipPosition === 'begin-end') {
                    switch (piece.direction) {
                        case 'down-left':
                            {
                                const cx = (x - piece.lerp) * Art.CELL_SIZE
                                const cy = (y + piece.lerp) * Art.CELL_SIZE
                                g.ellipse(cx, cy, Art.TIP_RADIUS, Art.TIP_RADIUS, 0, 0, 2 * Math.PI)
                            }
                            break
                        case 'down':
                            {
                                const cx = x * Art.CELL_SIZE
                                const cy = (y + piece.lerp) * Art.CELL_SIZE
                                g.ellipse(cx, cy, Art.TIP_RADIUS, Art.TIP_RADIUS, 0, 0, 2 * Math.PI)
                            }
                            break
                        case 'down-right':
                            {
                                const cx = (x + piece.lerp) * Art.CELL_SIZE
                                const cy = (y + piece.lerp) * Art.CELL_SIZE
                                g.ellipse(cx, cy, Art.TIP_RADIUS, Art.TIP_RADIUS, 0, 0, 2 * Math.PI)
                            }
                            break
                    }
                }
            }

            if (piece.tipPosition) {
                g.fillStyle = '#ededed'
                g.beginPath()
                drawTip()
                g.fill()

                g.beginPath()
                drawTip()
                g.stroke()
            }
        }
    }
}

const $canvas = document.querySelector('#wires-animation') as HTMLCanvasElement
new Art($canvas)
