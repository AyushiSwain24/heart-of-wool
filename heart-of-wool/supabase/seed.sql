-- Heart of Wool — seed data
-- Run AFTER schema.sql, in the same SQL Editor.
-- Re-running this is safe: it upserts on id, so it won't create duplicates.

insert into products (id, name, price, image, category, description, stock) values
-- Crochet Dolls
('doll-01', 'Strawberry Bunny Doll', 549, 'https://picsum.photos/seed/how-doll-01/600/600', 'crochet-dolls', 'A soft amigurumi bunny in a strawberry hood, hand-stitched with cotton yarn.', 6),
('doll-02', 'Sleepy Panda Doll', 599, 'https://picsum.photos/seed/how-doll-02/600/600', 'crochet-dolls', 'Round, huggable panda doll with embroidered sleepy eyes.', 4),
('doll-03', 'Honey Bear Doll', 579, 'https://picsum.photos/seed/how-doll-03/600/600', 'crochet-dolls', 'Classic teddy-style amigurumi bear in warm honey-brown yarn.', 8),
('doll-04', 'Mini Fox Doll', 499, 'https://picsum.photos/seed/how-doll-04/600/600', 'crochet-dolls', 'Pocket-sized crochet fox with a fluffy tail, great as a gift topper.', 10),
('doll-05', 'Lavender Elephant Doll', 629, 'https://picsum.photos/seed/how-doll-05/600/600', 'crochet-dolls', 'Dusty-lavender elephant doll with floppy stitched ears.', 0),
('doll-06', 'Cloud Sheep Doll', 549, 'https://picsum.photos/seed/how-doll-06/600/600', 'crochet-dolls', 'Textured loop-stitch sheep doll, soft as a cloud.', 5),
('doll-07', 'Baby Koala Doll', 589, 'https://picsum.photos/seed/how-doll-07/600/600', 'crochet-dolls', 'Grey-and-white koala doll clinging to a tiny crochet branch.', 7),
('doll-08', 'Pumpkin Cat Doll', 619, 'https://picsum.photos/seed/how-doll-08/600/600', 'crochet-dolls', 'Seasonal cat-in-a-pumpkin-hood doll, limited design.', 3),
('doll-09', 'Blossom Piglet Doll', 559, 'https://picsum.photos/seed/how-doll-09/600/600', 'crochet-dolls', 'Pink piglet doll with a little embroidered flower crown.', 9),
('doll-10', 'Starry Owl Doll', 649, 'https://picsum.photos/seed/how-doll-10/600/600', 'crochet-dolls', 'Night-blue owl doll with contrast star-stitch wings.', 2),

-- Resin Charms
('resin-01', 'Pressed Daisy Resin Charm', 249, 'https://picsum.photos/seed/how-resin-01/600/600', 'resin-charms', 'Real pressed daisy set in clear hand-poured resin.', 12),
('resin-02', 'Galaxy Swirl Resin Charm', 279, 'https://picsum.photos/seed/how-resin-02/600/600', 'resin-charms', 'Deep-blue and violet swirl resin charm with fine glitter.', 10),
('resin-03', 'Golden Leaf Resin Charm', 259, 'https://picsum.photos/seed/how-resin-03/600/600', 'resin-charms', 'Delicate gold leaf suspended in a clear resin teardrop.', 8),
('resin-04', 'Ocean Wave Resin Charm', 289, 'https://picsum.photos/seed/how-resin-04/600/600', 'resin-charms', 'Layered blue-green resin charm mimicking ocean waves.', 0),
('resin-05', 'Butterfly Wing Resin Charm', 299, 'https://picsum.photos/seed/how-resin-05/600/600', 'resin-charms', 'Iridescent butterfly-wing shaped resin charm with fine detailing.', 6),
('resin-06', 'Strawberry Slice Resin Charm', 229, 'https://picsum.photos/seed/how-resin-06/600/600', 'resin-charms', 'Playful strawberry-slice charm, glossy finish.', 14),
('resin-07', 'Moon Phase Resin Charm', 269, 'https://picsum.photos/seed/how-resin-07/600/600', 'resin-charms', 'Crescent moon charm with a starry-night resin fill.', 9),
('resin-08', 'Dried Lavender Resin Charm', 249, 'https://picsum.photos/seed/how-resin-08/600/600', 'resin-charms', 'Dried lavender sprigs set in a soft round resin charm.', 5),
('resin-09', 'Rainbow Sparkle Resin Charm', 259, 'https://picsum.photos/seed/how-resin-09/600/600', 'resin-charms', 'Multicolour glitter-layered resin charm, catches the light.', 11),
('resin-10', 'Mini Mushroom Resin Charm', 239, 'https://picsum.photos/seed/how-resin-10/600/600', 'resin-charms', 'Cute red-and-white mushroom charm in glossy resin.', 1),

-- Crochet Charms
('ccharm-01', 'Tiny Teddy Bag Charm', 199, 'https://picsum.photos/seed/how-ccharm-01/600/600', 'crochet-charms', 'Thumb-sized crochet teddy charm, great for bags and totes.', 15),
('ccharm-02', 'Mini Bunny Charm', 189, 'https://picsum.photos/seed/how-ccharm-02/600/600', 'crochet-charms', 'Tiny crochet bunny with a bow, clips onto zips or bags.', 13),
('ccharm-03', 'Little Cactus Charm', 179, 'https://picsum.photos/seed/how-ccharm-03/600/600', 'crochet-charms', 'Miniature crochet cactus-in-a-pot charm.', 0),
('ccharm-04', 'Cherry Duo Charm', 169, 'https://picsum.photos/seed/how-ccharm-04/600/600', 'crochet-charms', 'Two crochet cherries joined at the stem, bright red yarn.', 20),
('ccharm-05', 'Sunflower Charm', 199, 'https://picsum.photos/seed/how-ccharm-05/600/600', 'crochet-charms', 'Small sunflower charm with a dark brown centre.', 7),
('ccharm-06', 'Kitty Face Charm', 189, 'https://picsum.photos/seed/how-ccharm-06/600/600', 'crochet-charms', 'Round kitty-face charm with embroidered whiskers.', 9),
('ccharm-07', 'Mini Heart Charm', 149, 'https://picsum.photos/seed/how-ccharm-07/600/600', 'crochet-charms', 'Simple crochet heart charm, made in your choice-friendly colours.', 18),
('ccharm-08', 'Baby Penguin Charm', 209, 'https://picsum.photos/seed/how-ccharm-08/600/600', 'crochet-charms', 'Black-and-white penguin charm with an orange beak detail.', 4),
('ccharm-09', 'Strawberry Charm', 179, 'https://picsum.photos/seed/how-ccharm-09/600/600', 'crochet-charms', 'Classic red strawberry charm with green leaf top.', 12),
('ccharm-10', 'Mini Star Charm', 159, 'https://picsum.photos/seed/how-ccharm-10/600/600', 'crochet-charms', 'Five-point crochet star charm, made to order in any colour.', 16),

-- Crochet Keychains
('keych-01', 'Bear Face Keychain', 229, 'https://picsum.photos/seed/how-keych-01/600/600', 'crochet-keychains', 'Round bear-face keychain on a sturdy metal ring.', 10),
('keych-02', 'Avocado Keychain', 219, 'https://picsum.photos/seed/how-keych-02/600/600', 'crochet-keychains', 'Two-tone crochet avocado keychain with a felt seed.', 8),
('keych-03', 'Rainbow Cloud Keychain', 249, 'https://picsum.photos/seed/how-keych-03/600/600', 'crochet-keychains', 'Fluffy white cloud keychain with a rainbow underside.', 6),
('keych-04', 'Frog Keychain', 219, 'https://picsum.photos/seed/how-keych-04/600/600', 'crochet-keychains', 'Bright green frog keychain with a cheerful embroidered smile.', 0),
('keych-05', 'Donut Keychain', 239, 'https://picsum.photos/seed/how-keych-05/600/600', 'crochet-keychains', 'Pastel-glazed crochet donut keychain with sprinkle details.', 11),
('keych-06', 'Mini Panda Keychain', 229, 'https://picsum.photos/seed/how-keych-06/600/600', 'crochet-keychains', 'Black-and-white panda keychain, palm-sized and soft.', 5),
('keych-07', 'Ladybug Keychain', 199, 'https://picsum.photos/seed/how-keych-07/600/600', 'crochet-keychains', 'Red-and-black spotted ladybug keychain on a clasp ring.', 14),
('keych-08', 'Cactus Pot Keychain', 219, 'https://picsum.photos/seed/how-keych-08/600/600', 'crochet-keychains', 'Little potted cactus keychain, great for plant lovers.', 3),
('keych-09', 'Bee Keychain', 209, 'https://picsum.photos/seed/how-keych-09/600/600', 'crochet-keychains', 'Striped yellow-and-black bee keychain with net wings.', 9),
('keych-10', 'Heart Bow Keychain', 199, 'https://picsum.photos/seed/how-keych-10/600/600', 'crochet-keychains', 'Simple heart keychain topped with a tiny crochet bow.', 17)

on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  image = excluded.image,
  category = excluded.category,
  description = excluded.description,
  stock = excluded.stock;
