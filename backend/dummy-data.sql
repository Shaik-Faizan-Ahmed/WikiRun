-- Insert dummy data for leaderboards

-- Easy difficulty
INSERT INTO leaderboard (nickname, difficulty, clicks, time, path) VALUES
('SpeedRunner', 'easy', 3, 45230, '["United States", "California", "Los Angeles"]'),
('WikiMaster', 'easy', 4, 52100, '["France", "Paris", "Eiffel Tower", "Architecture"]'),
('QuickClicker', 'easy', 4, 58900, '["Japan", "Tokyo", "Shibuya", "Culture"]'),
('PathFinder', 'easy', 5, 61200, '["Germany", "Berlin", "Brandenburg Gate", "History", "World War II"]'),
('ArticleHunter', 'easy', 5, 67800, '["Italy", "Rome", "Colosseum", "Ancient Rome", "Gladiator"]'),
('LinkMaster', 'easy', 6, 72400, '["Spain", "Madrid", "Real Madrid", "Football", "UEFA", "Champions League"]'),
('FastReader', 'easy', 6, 78900, '["United Kingdom", "London", "Big Ben", "Clock Tower", "Architecture", "Gothic Revival"]'),
('WikiExplorer', 'easy', 7, 84200, '["Canada", "Toronto", "CN Tower", "Skyscraper", "Engineering", "Concrete", "Construction"]'),
('KnowledgeSeeker', 'easy', 7, 91500, '["Australia", "Sydney", "Opera House", "Architecture", "UNESCO", "World Heritage Site", "Tourism"]'),
('ArticleRunner', 'easy', 8, 98700, '["Brazil", "Rio de Janeiro", "Christ the Redeemer", "Statue", "Art Deco", "Sculpture", "Monument", "Tourism"]');

-- Medium difficulty
INSERT INTO leaderboard (nickname, difficulty, clicks, time, path) VALUES
('ProNavigator', 'medium', 5, 89400, '["Quantum Mechanics", "Wave Function", "Schrödinger Equation", "Physics", "Energy", "Matter"]'),
('ElitePlayer', 'medium', 6, 95200, '["Renaissance", "Leonardo da Vinci", "Mona Lisa", "Painting", "Art", "France", "Louvre"]'),
('ChainClicker', 'medium', 6, 102800, '["Photosynthesis", "Chloroplast", "Cell Biology", "Plant", "Oxygen", "Carbon Dioxide", "Atmosphere"]'),
('SmartNavigator', 'medium', 7, 108900, '["Byzantine Empire", "Constantinople", "Istanbul", "Turkey", "Ottoman Empire", "Europe", "Asia", "Geography"]'),
('LinkChaser', 'medium', 7, 116400, '["DNA", "Genetics", "Gene", "Chromosome", "Heredity", "Biology", "Evolution", "Charles Darwin"]'),
('WikiChampion', 'medium', 8, 123700, '["Industrial Revolution", "Steam Engine", "James Watt", "Scotland", "United Kingdom", "Europe", "Engineering", "Technology", "Innovation"]'),
('PathExpert', 'medium', 8, 132100, '["Baroque Music", "Johann Sebastian Bach", "Germany", "Composer", "Classical Music", "Organ", "Church", "Christianity", "Religion"]'),
('ArticleAce', 'medium', 9, 139800, '["Impressionism", "Claude Monet", "Water Lilies", "Painting", "France", "Paris", "Art Museum", "Musée de l''Orangerie", "Seine", "River"]'),
('ClickGenius', 'medium', 9, 148200, '["Greek Mythology", "Zeus", "Mount Olympus", "Greece", "Ancient Greece", "Philosophy", "Socrates", "Athens", "Democracy", "Politics"]'),
('WikiNinja', 'medium', 10, 156700, '["Astronomy", "Solar System", "Planet", "Earth", "Moon", "Orbit", "Gravity", "Isaac Newton", "Physics", "Mathematics", "Calculus"]');

-- Hard difficulty
INSERT INTO leaderboard (nickname, difficulty, clicks, time, path) VALUES
('LegendaryPlayer', 'hard', 8, 178900, '["Epistemology", "Philosophy", "Knowledge", "Belief", "Truth", "Logic", "Reasoning", "Aristotle", "Ancient Greece"]'),
('UltimateNavigator', 'hard', 9, 189200, '["Mitochondria", "Cell", "Biology", "Energy", "ATP", "Metabolism", "Biochemistry", "Chemistry", "Organic Chemistry", "Carbon"]'),
('GrandMaster', 'hard', 9, 198700, '["Existentialism", "Jean-Paul Sartre", "France", "Philosophy", "Phenomenology", "Edmund Husserl", "Germany", "Continental Philosophy", "Ethics", "Metaphysics"]'),
('ArticleLegend', 'hard', 10, 207400, '["Thermodynamics", "Entropy", "Physics", "Heat", "Energy", "Temperature", "Kelvin", "Absolute Zero", "Quantum Mechanics", "Particle Physics", "Standard Model"]'),
('PathLegend', 'hard', 10, 218900, '["Neuroscience", "Brain", "Neuron", "Nervous System", "Biology", "Psychology", "Cognitive Science", "Consciousness", "Philosophy of Mind", "Dualism", "René Descartes"]'),
('EliteMaster', 'hard', 11, 228100, '["Topology", "Mathematics", "Geometry", "Euclidean Geometry", "Ancient Greece", "Euclid", "Alexandria", "Egypt", "Ancient Egypt", "Nile", "River", "Geography"]'),
('WikiLegend', 'hard', 11, 239800, '["Plate Tectonics", "Geology", "Earth Science", "Lithosphere", "Mantle", "Core", "Earth", "Solar System", "Astronomy", "Universe", "Big Bang", "Cosmology"]'),
('PathSage', 'hard', 12, 251200, '["Romanticism", "Literature", "Poetry", "William Wordsworth", "England", "United Kingdom", "Europe", "Western Culture", "Culture", "Sociology", "Society", "Social Science", "Science"]'),
('ClickMaster', 'hard', 12, 264700, '["Electromagnetism", "Physics", "Electric Field", "Magnetic Field", "James Clerk Maxwell", "Scotland", "United Kingdom", "Europe", "Western World", "Civilization", "History", "Historiography", "Research"]'),
('WikiGod', 'hard', 13, 278900, '["Molecular Biology", "DNA", "RNA", "Protein", "Amino Acid", "Chemistry", "Biochemistry", "Metabolism", "Enzyme", "Catalyst", "Chemical Reaction", "Thermodynamics", "Physics", "Science"]);
