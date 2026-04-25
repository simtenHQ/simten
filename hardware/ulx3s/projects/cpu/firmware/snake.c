/*
 * Autoplay ASCII Snake for the RV32I CPU.
 *
 * Renders a 16×16 board to UART using ANSI escape sequences to re-draw
 * in place. The snake chases food with a simple greedy AI (no input, since
 * UART RX isn't wired up yet).
 *
 * Uses only powers-of-2 for dimensions so modulo/index math compiles to
 * shifts/ANDs — no software MUL/DIV needed.
 */

static volatile unsigned int* const UART = (volatile unsigned int*)0x80000000;

#define W 16
#define H 16
#define AREA (W * H)
#define SNAKE_MAX AREA            /* upper bound on snake length */
#define IDX(x, y)  (((y) << 4) | (x))
#define X_OF(p)    ((p) & 15)
#define Y_OF(p)    ((p) >> 4)

/* Cell states */
#define EMPTY 0
#define SNAKE 1
#define FOOD  2

/* ── UART helpers ─────────────────────────────────────────────────── */
static void putc(unsigned char c) {
    while (!(*UART & 1)) { }
    *UART = c;
}

static void puts_(const char* s) {
    while (*s) putc((unsigned char)*s++);
}

static void putn(unsigned int n) {
    /* print a small decimal — enough for score display */
    char buf[6];
    int i = 0;
    if (n == 0) { putc('0'); return; }
    while (n > 0 && i < 6) { buf[i++] = '0' + (n % 10); n /= 10; }
    while (i-- > 0) putc((unsigned char)buf[i]);
}

static void delay(unsigned int n) {
    for (volatile unsigned int i = 0; i < n; i++) { }
}

/* ── xorshift PRNG (no MUL needed) ────────────────────────────────── */
/* No initializer here → goes in .bss (NOLOAD). Seeded in main(). */
static unsigned int rng;
static unsigned int rnd(void) {
    rng ^= rng << 13;
    rng ^= rng >> 17;
    rng ^= rng << 5;
    return rng;
}

/* ── Game state ───────────────────────────────────────────────────── */
static unsigned char body[SNAKE_MAX];  /* circular buffer of (y<<4|x) */
static unsigned int  head_i;           /* index of head in body[] */
static unsigned int  tail_i;           /* index of tail */
static unsigned int  length;
static unsigned char board[AREA];      /* EMPTY / SNAKE / FOOD */
static unsigned int  food;
static unsigned int  score;

static void place_food(void) {
    unsigned int p;
    do { p = rnd() & (AREA - 1); } while (board[p] != EMPTY);
    food = p;
    board[p] = FOOD;
}

static void draw(void) {
    /* ANSI: move cursor to home (no clear → no flicker) */
    putc(0x1b); putc('['); putc('H');

    /* top border */
    for (int x = 0; x < W + 2; x++) putc('#');
    putc('\r'); putc('\n');

    for (int y = 0; y < H; y++) {
        putc('#');
        for (int x = 0; x < W; x++) {
            unsigned char c = board[IDX(x, y)];
            putc(c == SNAKE ? 'O' : c == FOOD ? '*' : ' ');
        }
        putc('#');
        putc('\r'); putc('\n');
    }

    /* bottom border */
    for (int x = 0; x < W + 2; x++) putc('#');
    putc('\r'); putc('\n');

    puts_("score: ");
    putn(score);
    puts_("   \r\n");
}

/* ── Game loop ────────────────────────────────────────────────────── */
void main(void) __attribute__((noreturn));
void main(void) {
    rng = 0xCAFEBABE;  /* seed PRNG — can't be 0 for xorshift */

    /* init board */
    for (int i = 0; i < AREA; i++) board[i] = EMPTY;

    /* init snake: length 3 in the middle, moving right */
    length = 3;
    tail_i = 0;
    int cx = W / 2;
    int cy = H / 2;
    for (unsigned int i = 0; i < length; i++) {
        int x = cx - (int)length + 1 + (int)i;
        unsigned int p = IDX(x, cy);
        body[i] = (unsigned char)p;
        board[p] = SNAKE;
    }
    head_i = length - 1;
    place_food();
    score = 0;

    /* clear screen once at startup */
    putc(0x1b); putc('['); putc('2'); putc('J');

    int dx = 1, dy = 0;

    for (;;) {
        unsigned int hp = body[head_i];
        int hx = X_OF(hp), hy = Y_OF(hp);
        int fx = X_OF(food), fy = Y_OF(food);

        /* greedy AI: move on whichever axis has larger delta */
        int adx = fx - hx; if (adx < 0) adx = -adx;
        int ady = fy - hy; if (ady < 0) ady = -ady;
        if (adx >= ady && fx != hx) {
            dx = (fx > hx) ? 1 : -1; dy = 0;
        } else if (fy != hy) {
            dy = (fy > hy) ? 1 : -1; dx = 0;
        }

        /* propose next head position; clamp to board (ricochet) */
        int nx = hx + dx, ny = hy + dy;
        if (nx < 0)  { nx = 0;     dx = 1;  }
        if (nx >= W) { nx = W - 1; dx = -1; }
        if (ny < 0)  { ny = 0;     dy = 1;  }
        if (ny >= H) { ny = H - 1; dy = -1; }
        unsigned int np = IDX(nx, ny);

        int ate = (board[np] == FOOD);

        /* advance head */
        head_i = (head_i + 1) & (SNAKE_MAX - 1);
        body[head_i] = (unsigned char)np;
        board[np] = SNAKE;

        if (ate) {
            length++;
            score++;
            place_food();
        } else {
            /* retract tail */
            unsigned int tp = body[tail_i];
            board[tp] = EMPTY;
            tail_i = (tail_i + 1) & (SNAKE_MAX - 1);
        }

        draw();
        delay(200000);  /* ~80ms @ 25 MHz */
    }
}
