// Game library sourced from 1v1-lolgame.github.io. Each game is embedded
// directly via its real game URL on classroom2111.github.io (not the site's
// wrapper page), so only the game renders inside the iframe. Names were
// identified from cover art via vision AI; the source site exposes only
// numbered thumbnails, no titles.
const THUMB = (id) => `https://classroom2111.github.io/img/class-${id}.png`;
const EMBED = (path) => `https://classroom2111.github.io/${path}/`;

const POPULAR = [
  [647, 'Drive Mad', 'g16/class-647'], [482, 'Basket Bros', 'g97/class-482'], [4, 'Tank Trouble', 'g50/class-4'], [415, 'Paper.io', 'g2/class-415'],
  [631, 'Watermelon Game', 'g72/class-631'], [526, 'Truck Loader', 'g26/class-526'], [404, 'Tunnel Rush', 'g5/class-404'], [826, 'Super Mario Bros', 'g/class-826'],
  [458, 'Moto X3M', 'g26/class-458'], [587, 'Tiger Simulator', 'g69/class-587'], [628, 'Soccer Legends', 'g69/class-628'], [461, 'Moto X3M Spooky Land', 'g5/class-461'],
  [455, 'Tetris', 'g97/class-455'], [480, 'The Impossible Quiz', 'g26/class-480'], [491, 'Red Ball 4', 'g22/class-491'], [29, 'Johnny Trigger', 'g50/class-29'],
  [450, 'Slope', 'g5/class-450'], [829, 'Monkey Mart', 'g77/class-829'], [474, 'Basketball Legends', 'g5/class-474'], [591, 'Who is Lying', 'g69/class-591'],
  [436, 'Basket Random', 'g26/class-436'], [448, 'Cookie Clicker', 'g5/class-448'], [583, 'Top Speed 3D', 'g69/class-583'], [378, 'Cat Ninja', 'g22/class-378'],
  [420, 'Blob Opera', 'g9/class-420'], [318, 'Peppa Pig Basketball', 'g3/class-318'], [413, 'Rocket Cars Highway', 'g16/class-413'], [511, 'Soccer Random', 'g26/class-511'],
  [528, 'Agar.io', 'g26/class-528'], [505, 'Paper.io 2', 'g/class-505'], [416, 'Stickman Army: The Defenders', 'g2/class-416'], [438, 'Maze Game', 'g26/class-438'],
  [447, 'Drift Hunters', 'g5/class-447'], [485, 'Draw Climber', 'g69/class-485'], [399, 'Ball Rolling Game', 'g22/class-399'], [566, 'Racing Game', 'g5/class-566'],
  [580, 'Murder', 'g72/class-580'], [411, 'Pixel Platformer', 'g69/class-411'], [476, 'Doge Miner', 'g97/class-476'], [725, 'Night Thief', 'g3/class-725'],
  [314, 'Moto X3M', 'g3/class-314'], [421, 'Slime Road', 'g16/class-421'], [590, 'Wheelie Bike', 'g2/class-590'], [350, 'Friday Night Funkin', 'fnf3/class-350'],
  [586, 'Forklift Simulator', 'g72/class-586'], [417, 'Stack', 'g2/class-417'], [400, 'Retro Bowl', 'g5/class-400'], [724, 'Parking Fury 3D: Beach City', 'g3/class-724'],
  [357, 'Parking Jam', 'g22/class-357'], [12, 'Stickman Warriors', 'g50/class-12'], [403, 'Hover Plus 3', 'g9/class-403'], [441, 'BitLife', 'g5/class-441'],
  [22, 'Fruit Ninja', 'g50/class-22'], [479, 'Getaway Shootout', 'g9/class-479'], [6, 'Stickman Hook', 'g50/class-6'], [426, 'Robo-Blast', 'g2/class-426'],
  [490, 'House of Hazards', 'g5/class-490'], [386, 'Cricket', 'g22/class-386'], [481, 'Rooftop Snipers', 'g5/class-481'], [393, 'Traffic Run', 'g22/class-393'],
];

const NEW = [
  [1153, "Carol's Haircut Salon", 'g89/class-1153'], [1197, 'Tic Tac Toe', 'g89/class-1197'], [1226, 'Middle Ages', 'g89/class-1226'],
  [1096, 'Jumping Clones', 'g68/class-1096'], [1151, 'Archery Game', 'g89/class-1151'], [1072, 'Firefighter Pinball', 'g68/class-1072'], [1006, 'Base Defense 2', 'g66/class-1006'],
  [1003, 'Super Kill-Boi 9000', 'g66/class-1003'], [1214, 'Amazing Word Search', 'g89/class-1214'], [1014, 'Dino Rush', 'g68/class-1014'], [1209, 'Squirrel Wars', 'g89/class-1209'],
  [1174, 'Draw Climber', 'g89/class-1174'], [1145, 'Gold Miner', 'g89/class-1145'], [1105, 'Ball Sort Puzzle', 'g68/class-1105'], [1220, 'Pop It Fidget', 'g89/class-1220'],
  [1219, 'Guess The Soccer Star', 'g89/class-1219'], [1155, 'Suika Game', 'g89/class-1155'], [1114, 'Puppet Master', 'g68/class-1114'], [1129, 'Pet Party Columns', 'g68/class-1129'],
  [1204, 'Drunken Duel', 'g89/class-1204'], [1024, 'Tower Defense Game', 'g68/class-1024'], [1029, 'Monster Defender', 'g68/class-1029'], [1018, 'Carrot Fantasy', 'g68/class-1018'],
];

export const GAMES = [
  ...POPULAR.map(([id, name, path]) => ({ id, name, cat: 'Popular', thumb: THUMB(id), url: EMBED(path) })),
  ...NEW.map(([id, name, path]) => ({ id, name, cat: 'New', thumb: THUMB(id), url: EMBED(path) })),
];

export const GAME_CATEGORIES = ['Popular', 'New'];