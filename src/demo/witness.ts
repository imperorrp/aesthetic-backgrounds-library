/**
 * The studio's journal: what you have witnessed, in which world, and when.
 *
 * Sightings: the first time each notable event happens in each world is kept (with the
 * seed and the moment, so you can go back), and every one after that is counted. Some
 * come within a minute; some take an afternoon. Unseen ones show as locked, which is
 * the point.
 *
 * The chronicle: the uncommon and rarer events as short lines of history, with the
 * map's own log line beside them when there is one.
 *
 * Worlds are keyed like their sound palettes: a universe id for the sector map, the
 * skin id for Undercity and the instruments. Storage is optional (tests pass none).
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Sight = { type: string; name: string; rarity: Rarity; line: string };

const s = (type: string, name: string, rarity: Rarity, line: string): Sight => ({ type, name, rarity, line });

/**
 * What can be seen in each world. Rarity comes from twenty simulated minutes over two
 * seeds (`scripts/sim.mjs`): common is dozens, uncommon a dozen or more, rare a handful,
 * legendary three or fewer.
 */
export const SIGHTS: Record<string, Sight[]> = {
  void: [
    s('jump', 'Gate transit', 'common', 'A fleet went through the gate.'),
    s('convoy', 'Convoy', 'common', 'A convoy formed up and set out.'),
    s('delivery', 'Delivery', 'common', 'Cargo reached its port.'),
    s('launch', 'Commissioning', 'uncommon', 'A new ship was commissioned.'),
    s('raid', 'Raid', 'uncommon', 'Raiders came out of the dark.'),
    s('distress', 'Distress call', 'uncommon', 'A distress call went out, and was relayed.'),
    s('lost', 'Fleet lost', 'uncommon', 'A fleet was lost with all hands.'),
    s('armada', 'Armada', 'rare', 'An armada came on station.'),
    s('flare', 'Stellar flare', 'rare', 'The star flared and blinded every sensor.'),
    s('scramble', 'Scramble', 'rare', 'Interceptors scrambled.'),
    s('surge', 'Gate surge', 'legendary', 'The jumpgate surged, and traffic poured through.'),
  ],
  saltwind: [
    s('collision', 'Rockfall', 'common', 'Rock met rock in the belt.'),
    s('checkpoint', 'Checkpoint', 'common', 'A hauler was stopped at the checkpoint.'),
    s('chase', 'Pursuit', 'common', 'Wardens gave chase.'),
    s('dispute', 'Claim dispute', 'common', 'Two crews claimed the same rock.'),
    s('distress', 'Distress call', 'common', 'A hauler called for help.'),
    s('raid', 'Claim jumpers', 'uncommon', 'Claim jumpers hit a hauler.'),
    s('storm', 'Dust storm', 'uncommon', 'A dust storm rolled down the old road.'),
    s('combat', 'Warning shots', 'uncommon', 'Warning shots, then real ones.'),
    s('blowout', 'Bore blowout', 'rare', 'A bore blew out. They cleared the shaft.'),
    s('shift', 'Shift change', 'rare', 'The shift changed and the lanes filled.'),
  ],
  choir: [
    s('song', 'Song', 'common', 'The choir sang.'),
    s('cascade', 'Cascade', 'common', 'The song carried from star to star.'),
    s('anagram', 'Restless names', 'common', 'The names on the chart rearranged themselves.'),
    s('echo', 'The same hour, twice', 'uncommon', 'The same hour came twice.'),
    s('hatch', 'Hatching', 'uncommon', 'Something hatched in a cradle.'),
    s('leviathan', 'Leviathan', 'uncommon', 'Something vast moved between the stars.'),
    s('caught', 'Taken', 'uncommon', 'The Mouth took a ship.'),
    s('eye', 'The eye', 'rare', 'An eye opened in the dark and looked at us.'),
    s('exhale', 'The Mouth exhales', 'rare', 'The Mouth exhaled.'),
    s('starbirth', 'Starbirth', 'rare', 'A hollow star was born.'),
    s('eclipse', 'Eclipse', 'rare', 'The light was eaten.'),
    s('starout', 'A star goes out', 'rare', 'A star went out.'),
  ],
  siege: [
    s('blast', 'Shelling', 'common', 'Shells walked along the wall.'),
    s('front', 'The front moves', 'common', 'The front moved a little.'),
    s('offensive', 'Offensive', 'common', 'An offensive began.'),
    s('spot', 'Target painted', 'uncommon', 'A spotter painted a target.'),
    s('bombard', 'Volley', 'uncommon', 'The big guns spoke.'),
    s('shield', 'Shield holds', 'uncommon', 'A shield took the volley and held.'),
    s('duel', 'Monitor duel', 'rare', 'Two monitors dueled across the line.'),
    s('monitor-lost', 'Monitor lost', 'rare', 'A monitor went down.'),
    s('mines', 'Chain of mines', 'rare', 'A minefield went up in a chain.'),
    s('truce', 'Truce', 'rare', 'A truce was called. The guns fell silent.'),
    s('truce-end', 'Truce ends', 'rare', 'The truce ended.'),
    s('raid', 'Commando raid', 'rare', 'Commandos struck behind the lines.'),
    s('supplycut', 'Supply cut', 'legendary', 'Interdictors cut the supply line.'),
    s('capture', 'A system falls', 'legendary', 'A system changed hands.'),
  ],
  hive: [
    s('spores', 'Spore burst', 'common', 'Spores burst from a hive node.'),
    s('settle', 'Spores settle', 'common', 'Spores settled, and something took root.'),
    s('bloom', 'A node blooms', 'uncommon', 'A new node bloomed.'),
    s('purge', 'Purge fleet', 'uncommon', 'The purge fleet lit its torches.'),
    s('infested', 'Overgrown', 'rare', 'A station was lost to the bloom.'),
    s('scourge', 'Napalm run', 'rare', 'A scourge made a napalm run on a node.'),
    s('evac', 'Evacuation', 'rare', 'A colony evacuated before the end.'),
    s('nodeburn', 'Node burned out', 'legendary', 'The purge burned out a hive node.'),
  ],
  lastfleet: [
    s('birth', 'A birth', 'common', 'A child was born aboard.'),
    s('skim', 'Fuel skim', 'common', 'Skimmers dove for fuel.'),
    s('lost', 'Ship lost', 'uncommon', 'A ship was lost, and everyone aboard.'),
    s('straggler', 'Straggler', 'uncommon', 'A ship fell behind.'),
    s('rescue', 'Rescue', 'uncommon', 'A tug went back for them, and brought them home.'),
    s('pursuit', 'They found us', 'rare', 'They found us again.'),
  ],
  cradle: [
    s('collapse', 'Collapse', 'common', 'A cloud of gas fell in on itself.'),
    s('ignite', 'First light', 'common', 'A star ignited.'),
    s('planets', 'Planets', 'common', 'Planets formed around a young star.'),
    s('life', 'Life', 'common', 'Life began.'),
    s('civilization', 'The first cities', 'common', 'The first cities rose.'),
    s('firstships', 'First ships', 'common', 'The first ships left a world.'),
    s('colony', 'Colony', 'uncommon', 'A colony was founded on another world.'),
    s('contact', 'First contact', 'uncommon', 'Two peoples found each other.'),
    s('silence', 'The lights go out', 'rare', 'A world went silent.'),
    s('era', 'A new era', 'rare', 'An era ended, and another began.'),
    s('supernova', 'Supernova', 'legendary', 'A star died in a supernova.'),
  ],
  undercity: [
    s('train', 'The high line', 'common', 'A train went by on the high line.'),
    s('jackin', 'Jack in', 'uncommon', 'A runner jacked in.'),
    s('ice', 'ICE', 'uncommon', 'ICE woke up.'),
    s('police', 'Units en route', 'uncommon', 'The precinct sent units.'),
    s('flatline', 'Flatline', 'uncommon', 'A runner flatlined.'),
    s('breach', 'Breach', 'rare', 'A run broke through, and the data walked.'),
    s('outage', 'Grid failure', 'rare', 'A district went dark.'),
    s('lightning', 'Lightning', 'legendary', 'Lightning struck the city.'),
  ],
  shieldwall: [
    s('volley', 'Volley', 'common', 'Arrows darkened the sky.'),
    s('impact', 'Stones from the engines', 'common', 'A stone from the engines struck home.'),
    s('charge', 'Cavalry charge', 'common', 'The horse charged.'),
    s('rout', 'A regiment breaks', 'common', 'A regiment broke and ran.'),
    s('clash', 'The lines meet', 'uncommon', 'The lines met with a sound like a storm.'),
    s('victory', 'The field is held', 'uncommon', 'One army held the field.'),
    s('fireball', 'Fireball', 'uncommon', 'A mage threw fire.'),
    s('lightning', 'Called lightning', 'uncommon', 'Lightning was called down on the ranks.'),
    s('ward', 'A ward', 'uncommon', 'A ward caught the arrows.'),
    s('smite', 'Sunfire', 'uncommon', 'Light fell like a spear.'),
    s('raise', 'The dead rise', 'rare', 'The fallen got up again, for the other side.'),
    s('rally', 'A rally', 'rare', 'A lord rode to a breaking line and held it.'),
    s('duel', 'The lords duel', 'rare', 'The lords met between the lines.'),
    s('lordfall', 'A lord falls', 'rare', 'A lord fell.'),
    s('dragon', 'Dragon', 'rare', 'A dragon came down on both armies.'),
    s('peace', 'A war is won', 'rare', 'A war ended, three battles to fewer.'),
    s('siege', 'A siege', 'uncommon', 'An army came to a walled town and sat down before it.'),
    s('breach', 'The wall is breached', 'uncommon', 'Stones from the engines brought a stretch of wall down.'),
    s('tower', 'A tower at the wall', 'uncommon', 'A siege tower reached the wall and dropped its bridge.'),
    s('grassfire', 'The grass burns', 'uncommon', 'Fire got into the grass and ran with the wind.'),
    s('standardfalls', 'The standard falls', 'uncommon', 'A standard went down, and the wing near it wavered.'),
    s('gate', 'The gate breaks', 'rare', 'The ram broke the gate.'),
    s('towerburns', 'A tower burns', 'rare', 'A siege tower was set alight before it reached the wall.'),
    s('ambush', 'Ambush', 'rare', 'Riders came out of the wood on the flank.'),
    s('stormed', 'A town is taken', 'rare', 'The walls were stormed and the town taken.'),
    s('lifted', 'The siege is lifted', 'rare', 'The besiegers gave it up and went home.'),
    s('magelight', 'Magelight', 'rare', 'A mage hung a light over the field at night.'),
    s('dragonslain', 'Dragon slain', 'legendary', 'A dragon was brought down.'),
  ],
  ages: [
    s('founded', 'A town is founded', 'common', 'Settlers walked out and built a new town.'),
    s('battle', 'Battle in the field', 'common', 'Two armies met in the field.'),
    s('siege', 'Siege', 'common', 'An army sat down outside the walls.'),
    s('trade', 'Trade at sea', 'common', 'A ship came in with cargo.'),
    s('city', 'A city rises', 'uncommon', 'A town grew into a city.'),
    s('war', 'War', 'uncommon', 'Two kingdoms went to war over their border.'),
    s('captured', 'A town falls', 'uncommon', 'A town changed hands.'),
    s('peace', 'Peace', 'uncommon', 'A peace was made, and kept a while.'),
    s('fire', 'A town burns', 'uncommon', 'A town burned.'),
    s('plague', 'Plague', 'rare', 'Plague travelled the roads.'),
    s('era', 'A new era', 'rare', 'An era turned.'),
    s('wonder', 'A wonder', 'rare', 'A wonder was raised in a capital.'),
    s('horde', 'A horde', 'rare', 'A horde came out of the wild.'),
    s('schism', 'Civil war', 'rare', 'A kingdom split in two.'),
    s('fall', 'A kingdom falls', 'rare', 'A kingdom was no more.'),
    s('dragon', 'Dragon', 'rare', 'A dragon woke in the mountains.'),
    s('ageends', 'The age ends', 'rare', 'An age ended, and a new land rose.'),
    s('succession', 'The crown passes', 'common', 'A ruler died, and an heir took the crown.'),
    s('wonderbegun', 'Work begins', 'uncommon', 'Work began on a wonder; it would take a lifetime.'),
    s('dynastyends', 'A house ends', 'uncommon', 'A ruling house died out, and another took the throne.'),
    s('flood', 'Flood', 'rare', 'A river broke its banks.'),
    s('volcano', 'A mountain wakes', 'rare', 'A volcano woke, and ash fell on the towns below.'),
    s('unified', 'One crown', 'legendary', 'One crown ruled all the land.'),
  ],
  'war-table': [
    s('order', 'Orders in ink', 'common', 'An order was drawn on the map.'),
    s('battle', 'Battle', 'common', 'Two armies met, and one fell back.'),
    s('siege', 'Siege', 'common', 'A town was put under siege.'),
    s('ambush', 'Ambush on the road', 'uncommon', 'Two armies ran into each other on the road.'),
    s('captured', 'A town falls', 'uncommon', 'A town changed hands.'),
    s('winter', 'Winter quarters', 'uncommon', 'The armies went into winter quarters.'),
    s('peace', 'A peace is sealed', 'uncommon', 'A peace was sealed in wax.'),
    s('burned', 'A town burned', 'rare', 'A town was burned when it fell.'),
    s('betrayal', 'A turned coat', 'rare', 'A town turned its coat.'),
    s('sickness', 'Sickness in the camp', 'rare', 'Sickness went through a camp.'),
    s('kingtaken', 'A king is taken', 'rare', 'A king was taken in the field.'),
    s('yields', 'A realm yields', 'rare', 'A realm lost its seat and yielded.'),
    s('dispatch', 'A sealed letter', 'common', 'A rider set out from the seat with sealed orders.'),
    s('intercepted', 'A rider taken', 'uncommon', 'A rider was taken on the road, and the letter read.'),
    s('forgery', 'A false letter', 'rare', 'A letter under a stolen seal led an army into a trap.'),
    s('dragon', 'Here be dragons', 'legendary', 'A dragon crossed the map and burned a town.'),
  ],
  wyrmspire: [
    s('horn', 'The horn', 'common', 'The watch sounded the horn.'),
    s('wake', 'The wyrm wakes', 'common', 'The wyrm woke in its spire.'),
    s('ride', 'The knights ride', 'common', 'The knights rode out from the castle.'),
    s('dragonfire', 'A village burns', 'common', 'Fire fell on a village.'),
    s('wardholds', 'The ward holds', 'common', 'A ward turned the fire from the roofs.'),
    s('rebuild', 'Rebuilt', 'common', 'A burnt village was rebuilt.'),
    s('driven', 'Driven off', 'uncommon', 'The knights drove the wyrm back to its spire.'),
    s('hatch', 'An egg hatches', 'rare', 'An egg hatched in the spire.'),
    s('fledge', 'The wyrmling flies', 'rare', 'A wyrmling grown flew off to find its own spire.'),
    s('dragonfight', 'Two dragons', 'rare', 'Two dragons fought in the air over the valley.'),
    s('newwyrm', 'A new wyrm', 'rare', 'A wyrm came to the empty spire.'),
    s('dragonslain', 'The wyrm is slain', 'legendary', 'A wyrm fell out of the sky.'),
    s('hunt', 'The wyrm hunts', 'common', 'The wyrm came down on a herd and carried off what it caught.'),
    s('patrol', 'On patrol', 'common', 'The wyrm flew the length of its valley.'),
    s('bask', 'Basking', 'common', 'The wyrm lay out on its spire in the sun.'),
    s('grows', 'A village grows', 'common', 'A village left in peace built another house.'),
    s('harvest', 'Harvest', 'common', 'The harvest carts went to the castle.'),
    s('frostbreath', 'Frost', 'uncommon', 'A frost wyrm breathed ice over a village.'),
    s('stormbreath', 'Lightning', 'uncommon', 'A storm drake called lightning down.'),
    s('venombreath', 'Venom', 'uncommon', 'A venom wyrm left its fields withered.'),
    s('shadowbreath', 'The pall', 'uncommon', 'A shadow wyrm put out every light in a village.'),
    s('policy', 'The lord decides', 'uncommon', 'The lord changed how the valley dealt with its wyrm.'),
    s('ballista', 'Ballista tower', 'uncommon', 'A ballista tower was raised by a village.'),
    s('tribute', 'Tribute', 'uncommon', 'A village sent gold to the foot of the spire.'),
    s('collect', 'Tribute taken', 'uncommon', 'The wyrm came down at night for its tribute.'),
    s('festival', 'Festival of lanterns', 'uncommon', 'A village let lanterns go on a midwinter night.'),
    s('hero', 'A hero rides', 'uncommon', 'A hero rode out alone to the spire.'),
    s('thieves', 'Thieves on the path', 'uncommon', 'Shapes climbed the spire path by night.'),
    s('rage', 'Rampage', 'rare', 'Robbed, the wyrm went from village to village.'),
    s('theft', 'The hoard robbed', 'rare', 'Thieves got away with gold from the hoard.'),
    s('caught', 'The thieves caught', 'rare', 'The thieves woke the wyrm.'),
    s('cavefight', 'At the cave', 'rare', 'Someone faced the wyrm at its cave.'),
    s('herofalls', 'A sword on the ledge', 'rare', 'A hero fell at the cave; the sword is still there.'),
    s('wyrmflees', 'Driven from the valley', 'rare', 'The wyrm fled its valley, wounded.'),
    s('returns', 'The wyrm returns', 'rare', 'The wyrm came back, healed.'),
    s('bound', 'Chains of light', 'legendary', 'A wizard bound the wyrm in its spire.'),
    s('raid', 'A raid', 'uncommon', 'The wyrm fell on a village, and the beacons were lit.'),
    s('harass', 'A drake harries', 'common', 'A drake harried a village, setting roofs alight.'),
    s('raised', 'A new building', 'common', 'The valley raised a church, a mill, a granary, a ballista tower.'),
    s('tournament', 'A tournament', 'uncommon', 'Knights tilted at the lists while the valley watched.'),
    s('fair', 'The great fair', 'uncommon', 'Caravans came from both ends of the road for the fair.'),
    s('giant', 'A hill giant', 'rare', 'A hill giant came down into the valley.'),
    s('troll', 'The troll under the bridge', 'uncommon', 'Something under the bridge took a traveller.'),
    s('drakefalls', 'A drake falls', 'uncommon', 'Arrows and bolts brought a drake down.'),
  ],
  deephold: [
    s('strike', 'A strike', 'common', 'A miner struck a new vein.'),
    s('room', 'A room is finished', 'common', 'The masons finished a room.'),
    s('deeper', 'A new deep', 'common', 'The shaft went down to a new deep.'),
    s('caravan', 'A caravan', 'common', 'Traders came up the mountain with their mules.'),
    s('gold', 'Gold', 'uncommon', 'A vein of gold was struck.'),
    s('gems', 'Gems', 'uncommon', 'Gems glittered in the rock.'),
    s('cavein', 'Cave-in', 'uncommon', 'A roof came down.'),
    s('flood', 'Flood', 'uncommon', 'Water broke in from an aquifer.'),
    s('goblins', 'Goblins at the gate', 'uncommon', 'Goblins came up the mountain to the gate.'),
    s('feast', 'A feast', 'uncommon', 'The clan feasted in the great hall.'),
    s('mood', 'A strange mood', 'uncommon', 'A dwarf was taken by a strange mood.'),
    s('crowned', 'A king crowned', 'uncommon', 'A new king was crowned.'),
    s('migrants', 'Migrants', 'uncommon', 'Migrants came to the hold.'),
    s('magma', 'Magma', 'rare', 'The miners broke into magma.'),
    s('firedamp', 'Firedamp', 'rare', 'Firedamp went up in a coal seam.'),
    s('cavern', 'A cavern', 'rare', 'The miners broke into a cavern of glowing fungus.'),
    s('ruin', 'The old halls', 'rare', 'The miners broke into the halls of an older people.'),
    s('deadwake', 'The dead wake', 'rare', 'The dead of the old halls rose.'),
    s('artifact', 'An artifact', 'rare', 'A dwarf in a strange mood forged an artifact.'),
    s('mithril', 'Mithril', 'rare', 'Mithril was struck, deep down.'),
    s('gatebreak', 'The gate breaks', 'rare', 'The gate gave way.'),
    s('stir', 'Something stirs', 'rare', 'Something stirred far below.'),
    s('seal', 'The shaft is sealed', 'rare', 'The masons sealed the shaft above what was coming.'),
    s('sleeperwakes', 'It wakes', 'legendary', 'They dug too greedily and too deep, and it woke.'),
    s('sleeperslain', 'It is slain', 'legendary', 'What slept below was slain.'),
    s('holdfalls', 'The hold falls', 'legendary', 'The hold fell, and the last of the clan fled.'),
    s('reclaim', 'Reclaimed', 'legendary', 'Another clan came to reclaim the hold.'),
    s('trade', 'Trade', 'common', 'Traders came, from the road or from below.'),
    s('swarm', 'A swarm', 'uncommon', 'A swarm poured out of the hive.'),
    s('golems', 'Golems', 'uncommon', 'The engine sent out its golems.'),
    s('deepfolk', 'The deep gnomes', 'uncommon', 'The miners met the deep gnomes, and they traded.'),
    s('warren', 'A goblin warren', 'uncommon', 'The miners broke into a goblin warren.'),
    s('plague', 'The spore-sickness', 'rare', 'A sickness went from dwarf to dwarf.'),
    s('geode', 'A geode', 'rare', 'The miners broke into a hollow lined with crystal.'),
    s('shrine', 'A sunken shrine', 'rare', 'The clan found a shrine under the mountain, and feasted.'),
    s('breakthrough', 'It breaks through', 'rare', 'Something below broke through the rock to the hold.'),
    s('lich', 'The lich rises', 'legendary', 'Something old rose in the old halls and raised the dead.'),
    s('engine', 'The engine wakes', 'legendary', 'An elder engine turned over, and woke.'),
    s('hive', 'The hive stirs', 'legendary', 'A queen stirred in her hive.'),
    s('bossslain', 'It is ended', 'legendary', 'The soldiers came down to the thing below, and ended it.'),
    s('highway', 'A highway', 'uncommon', 'A highway was cut under the mountains from one hold to the next.'),
    s('grandwork', 'A grand work', 'common', 'A clan began a great hall, a vault, or a gallery of its kings.'),
    s('face', 'A king in stone', 'rare', "A clan carved its first king's face into the mountain."),
    s('war', 'War between the holds', 'rare', 'One hold marched on another.'),
    s('sack', 'A hold sacked', 'rare', "Soldiers sacked an enemy hold's hall."),
    s('peace', 'Peace', 'uncommon', 'Two holds made peace.'),
    s('dragon', 'A dragon', 'rare', "A dragon came over the peaks to a hold's gate."),
    s('dragonslain', 'The dragon falls', 'legendary', 'The crossbows of a hold brought a dragon down.'),
  ],
  leylines: [
    s('tower', 'A tower is raised', 'common', 'An order raised a tower on a node of the lines.'),
    s('duel', 'A duel along the line', 'common', 'Two orders fought along a line, beam against beam.'),
    s('storm', 'Arcane storm', 'common', 'A storm of wild power crossed the land.'),
    s('elemental', 'An elemental', 'uncommon', 'An order sent an elemental down the lines.'),
    s('towerfalls', 'A tower falls', 'uncommon', 'A tower fell.'),
    s('turned', 'A tower turned', 'uncommon', 'A tower was taken by another order.'),
    s('burnout', 'A line burns out', 'uncommon', 'A line carried more than it could, and burned out.'),
    s('pact', 'A pact', 'uncommon', 'Two orders sealed a pact.'),
    s('war', 'War', 'uncommon', 'An order went to war with another.'),
    s('peace', 'Peace', 'uncommon', 'Two orders made peace.'),
    s('archmage', 'The staff passes', 'uncommon', 'An archmage died, and another took the staff.'),
    s('betrayal', 'Betrayal', 'rare', 'An order broke its pact.'),
    s('schism', 'Schism', 'rare', 'An order split in two.'),
    s('rift', 'A rift', 'rare', 'The world tore open at a node.'),
    s('riftclosed', 'The rift is closed', 'rare', 'Ritualists closed a rift.'),
    s('orderends', 'An order ends', 'rare', 'An order lost its last tower.'),
    s('neworder', 'A new order', 'rare', 'A new order rose at a free well.'),
    s('greatwork', 'A great work', 'legendary', 'An order raised its great work.'),
    s('convergence', 'The convergence', 'legendary', 'The moons came into line, and every well burned.'),
    s('claim', 'A well changes hands', 'common', 'One order\'s lines took a well from another\'s.'),
    s('clash', 'Living borders', 'common', 'Two orders\' lines ground against each other.'),
    s('pilgrims', 'Pilgrims', 'common', 'A lantern procession walked the lines between two wells.'),
    s('migration', 'Migration', 'common', 'A flock crossed the land.'),
    s('aurora', 'Aurora', 'uncommon', 'Lights hung over the north, and the lines bent toward them.'),
    s('tide', 'A ley-tide', 'uncommon', 'A wave of power swept the land.'),
    s('rise', 'An order rises', 'uncommon', 'A new order rose at a free well.'),
    s('fade', 'An order fades', 'uncommon', 'An order lost its last well and faded from the map.'),
    s('comet', 'A comet', 'rare', 'A comet crossed the sky and laid a new line.'),
    s('starfall', 'Starfall', 'rare', 'Stars fell, and new wells opened where they struck.'),
    s('quake', 'The land breaks', 'rare', 'A fault opened across the lines.'),
    s('eclipse', 'Eclipse', 'rare', 'The sun was eaten, and the wells grew dim.'),
    s('blight', 'Blight', 'rare', 'A hostile growth ate the orders\' lines.'),
    s('leviathan', 'The leviathan', 'legendary', 'Something vast moved under the lines.'),
    s('artifact', 'An artifact', 'rare', 'A mage found an artifact in the ruins of an older age.'),
    s('guardian', 'A guardian wakes', 'uncommon', 'A stone guardian woke in the ruins.'),
    s('greattower', 'A tower crowned', 'rare', 'An order crowned its tower, the highest in the land.'),
    s('wardbreaks', 'A ward breaks', 'uncommon', "A tower's ward broke under siege."),
    s('dragon', 'A dragon', 'rare', 'A dragon came over the hills.'),
    s('dragonslain', 'The dragon falls', 'legendary', 'The mages of the realm brought a dragon down.'),
    s('giant', 'A giant', 'uncommon', 'A giant came down from the hills.'),
  ],
  petri: [
    s('emerge', 'A new organism', 'common', 'A new organism came together.'),
    s('division', 'Division', 'common', 'An organism divided in two.'),
    s('engulf', 'Engulfing', 'common', 'One organism swallowed another.'),
    s('drop', 'Nutrient drop', 'common', 'The technician added a drop of nutrients.'),
    s('dissolve', 'Dissolution', 'uncommon', 'An organism came apart.'),
    s('mutation', 'The medium shifts', 'uncommon', 'The medium shifted, and a strain adapted.'),
    s('colony', 'A colony', 'uncommon', 'An organism grew into a colony.'),
    s('symbiosis', 'Symbiosis', 'uncommon', 'Three strains lived as one.'),
    s('toxin', 'Zone of inhibition', 'rare', 'An antibiotic disk cleared a ring around itself.'),
    s('hunt', 'The hunters feed', 'common', 'The hunting strain caught its prey.'),
    s('refocus', 'Autofocus', 'common', 'The focus drifted, and the autofocus hunted for it.'),
    s('starve', 'Starvation', 'uncommon', 'Cells starved where the medium was spent.'),
    s('bloom', 'The hunters bloom', 'rare', 'The hunters were suddenly everywhere.'),
    s('crash', 'The hunters crash', 'rare', 'The hunters ate themselves out, and died back.'),
    s('contamination', 'Contamination', 'rare', 'Something got in at the rim, and converted what it touched.'),
    s('sterilize', 'Sterilized', 'rare', 'The UV lamp killed the contaminant.'),
    s('dilute', 'Overgrowth, diluted', 'rare', 'A Lenia culture overgrew the field and was diluted.'),
    s('giant', 'Something large', 'legendary', 'Something enormous drifted through the field.'),
  ],
  sonar: [
    s('contact', 'Contact', 'common', 'A new contact on the scope.'),
    s('echo', 'Echo', 'common', 'An echo came back.'),
    s('active', 'Active ping', 'uncommon', 'We pinged, loud.'),
    s('turn', 'Hard turn', 'uncommon', 'The boat turned hard.'),
    s('whale', 'Whale song', 'uncommon', 'A whale sang somewhere below.'),
    s('torpedo', 'Torpedo', 'uncommon', 'Torpedo in the water.'),
    s('decoy', 'Decoy', 'rare', 'A decoy went out.'),
    s('detonation', 'Detonation', 'rare', 'A detonation shook the hull.'),
  ],
  'atc-radar': [
    s('transmit', 'Radio call', 'common', 'A pilot called in.'),
    s('landing', 'Landing', 'common', 'A flight landed.'),
    s('departure', 'Departure', 'common', 'A flight departed.'),
    s('hold', 'Holding', 'uncommon', 'A flight entered the hold.'),
    s('goaround', 'Go-around', 'rare', 'A flight went around.'),
    s('conflict', 'Conflict alert', 'rare', 'Two flights came too close.'),
    s('emergency', 'Mayday', 'legendary', 'A flight declared an emergency.'),
  ],
  seismograph: [
    s('quake', 'Earthquake', 'common', 'The ground shook.'),
    s('blast', 'Quarry blast', 'uncommon', 'The quarry blasted.'),
    s('tremor', 'Volcanic tremor', 'uncommon', 'The volcano trembled for a while.'),
    s('aftershock', 'Aftershock', 'uncommon', 'An aftershock.'),
    s('teleseism', 'Distant great quake', 'rare', 'A great earthquake, half a world away.'),
  ],
  abyssal: [
    s('flash', 'Bioluminescence', 'common', 'Something flashed in the deep.'),
    s('scatter', 'Scatter', 'common', 'A shoal scattered.'),
    s('hunt', 'The hunt', 'uncommon', 'A hunter stalked.'),
    s('strike', 'Strike', 'uncommon', 'A hunter struck.'),
    s('spit', 'Spitting light', 'uncommon', 'Something spat light to get away.'),
    s('vent', 'Vent field', 'rare', 'A vent field breathed.'),
    s('giant', 'Something enormous', 'legendary', 'Something enormous passed the scanner.'),
  ],
  'mars-radar': [
    s('drive', 'Rover drive', 'common', 'The rover drove a little farther.'),
    s('core', 'Core sample', 'common', 'The rover took a core.'),
    s('pass', 'Orbiter pass', 'common', 'An orbiter passed over.'),
    s('devil', 'Dust devil', 'uncommon', 'A dust devil spun up.'),
    s('flight', 'Helicopter flight', 'uncommon', 'The helicopter flew.'),
    s('storm', 'Dust storm', 'rare', 'A dust storm came in.'),
    s('clear', 'Clear skies', 'rare', 'The storm cleared.'),
    s('meteor', 'Meteor', 'rare', 'A meteor fell.'),
    s('entry', 'Entry', 'legendary', 'A lander came in through the atmosphere.'),
    s('landing', 'Touchdown', 'legendary', 'Touchdown.'),
  ],
};

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

export function sightFor(world: string, type: string): Sight | undefined {
  return SIGHTS[world]?.find((x) => x.type === type);
}

export type Sighting = {
  /** Times seen. */
  n: number;
  /** When first seen (epoch ms). */
  first: number;
  /** The seed and sim time it was first seen at, to go back. */
  seed: string;
  t: number;
  /** The studio source it happened in (`void-tactical`, `undercity`, an instrument). */
  source: string;
};

export type ChronicleEntry = {
  /** Epoch ms. */
  at: number;
  world: string;
  source: string;
  type: string;
  line: string;
  rarity: Rarity;
  /** The map's own log line, when it said one. */
  detail?: string;
  seed: string;
  /** Sim seconds. */
  t: number;
  /** How many times in a row (repeats within a short window fold in). */
  n: number;
  first?: boolean;
  /** Happened while the tab was hidden (simulated on return). */
  away?: boolean;
};

export type JournalData = {
  v: 1;
  sightings: Record<string, Record<string, Sighting>>;
  chronicle: ChronicleEntry[];
  prefs: { away: boolean; announce: boolean };
};

export type Witnessed = { sight: Sight; first: boolean; entry?: ChronicleEntry };

const KEY = 'bge.journal.v1';
const CHRONICLE_CAP = 250;
/** Repeats of the same thing within this many sim seconds fold into one line. */
const FOLD_SECONDS = 25;

const empty = (): JournalData => ({ v: 1, sightings: {}, chronicle: [], prefs: { away: true, announce: true } });

function load(storage: Storage | null): JournalData {
  if (!storage) return empty();
  try {
    const raw = JSON.parse(storage.getItem(KEY) ?? 'null') as JournalData | null;
    if (!raw || raw.v !== 1) return empty();
    return { ...empty(), ...raw, prefs: { ...empty().prefs, ...raw.prefs } };
  } catch {
    return empty();
  }
}

export type Journal = ReturnType<typeof createJournal>;

export function createJournal(storage: Storage | null = null, now: () => number = Date.now) {
  let data = load(storage);
  const listeners = new Set<() => void>();
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Snapshots are never mutated: each change makes a new one, so React sees it. */
  const commit = (next: JournalData) => {
    data = next;
    for (const fn of listeners) fn();
    if (!storage || saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        storage.setItem(KEY, JSON.stringify(data));
      } catch {
        /* storage full or blocked */
      }
    }, 800);
  };

  return {
    get data(): JournalData {
      return data;
    },
    subscribe(fn: () => void): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /**
     * Something happened. Counts it if it is one of this world's sights, and writes it
     * into the chronicle when it is uncommon or rarer, or the first of its kind.
     * Returns null for events the world does not keep.
     */
    witness(world: string, type: string, at: { source: string; seed: string; t: number; detail?: string; away?: boolean }): Witnessed | null {
      const sight = sightFor(world, type);
      if (!sight) return null;
      const known = data.sightings[world]?.[type];
      const first = !known;
      const book = { ...(data.sightings[world] ?? {}), [type]: known ? { ...known, n: known.n + 1 } : { n: 1, first: now(), seed: at.seed, t: at.t, source: at.source } };
      let chronicle = data.chronicle;

      let entry: ChronicleEntry | undefined;
      if (first || sight.rarity !== 'common') {
        const last = chronicle[chronicle.length - 1];
        if (!first && last && last.world === world && last.type === type && last.seed === at.seed && at.t - last.t < FOLD_SECONDS && !!last.away === !!at.away) {
          entry = { ...last, n: last.n + 1, t: at.t, detail: at.detail ?? last.detail };
          chronicle = [...chronicle.slice(0, -1), entry];
        } else {
          entry = { at: now(), world, source: at.source, type, line: sight.line, rarity: sight.rarity, detail: at.detail, seed: at.seed, t: at.t, n: 1, first, away: at.away };
          chronicle = [...chronicle, entry].slice(-CHRONICLE_CAP);
        }
      }
      commit({ ...data, sightings: { ...data.sightings, [world]: book }, chronicle });
      return { sight, first, entry };
    },

    /** Seen and total for a world. */
    progress(world: string): { seen: number; total: number } {
      const all = SIGHTS[world] ?? [];
      const book = data.sightings[world] ?? {};
      return { seen: all.filter((x) => book[x.type]).length, total: all.length };
    },

    setPref(key: keyof JournalData['prefs'], value: boolean) {
      commit({ ...data, prefs: { ...data.prefs, [key]: value } });
    },

    clearChronicle() {
      commit({ ...data, chronicle: [] });
    },

    /** Forget everything: sightings, chronicle, preferences. */
    reset() {
      commit(empty());
    },
  };
}

/** Sim seconds as m:ss (or h:mm:ss). */
export function clock(t: number): string {
  const sec = Math.max(0, Math.floor(t));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = String(sec % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** The chronicle as plain text, oldest first, for copying. */
export function chronicleText(entries: readonly ChronicleEntry[], worldName: (id: string) => string): string {
  return entries
    .map((e) => {
      const head = `[${worldName(e.world)} · ${clock(e.t)}${e.away ? ' · while you were away' : ''}]`;
      const times = e.n > 1 ? ` (×${e.n})` : '';
      return `${head} ${e.line}${times}${e.detail ? ` — ${e.detail}` : ''}`;
    })
    .join('\n');
}

/**
 * What happened while you were away, in a sentence: the rarest things first, counted.
 * `found` is a list of sights in the order they happened.
 */
export function awaySummary(found: readonly Sight[], max = 4): string {
  if (!found.length) return 'Nothing much. It was quiet.';
  const counts = new Map<string, { sight: Sight; n: number }>();
  for (const x of found) {
    const c = counts.get(x.type);
    if (c) c.n++;
    else counts.set(x.type, { sight: x, n: 1 });
  }
  const ranked = [...counts.values()].sort((a, b) => RARITY_ORDER.indexOf(b.sight.rarity) - RARITY_ORDER.indexOf(a.sight.rarity) || b.n - a.n);
  const parts = ranked.slice(0, max).map(({ sight, n }) => (n > 1 ? `${sight.name.toLowerCase()} ×${n}` : sight.name.toLowerCase()));
  const more = ranked.length - max;
  const text = parts.join(', ') + (more > 0 ? `, and ${more} more` : '');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}
