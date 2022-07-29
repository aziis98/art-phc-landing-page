# PHC Wires Art

This is the second version of the _wire art_ for the landing page of the new PHC website.

The first version stored wires as polylines so computing intersections when adding a new wire was _O(|number of segments| * |number of segments in whole canvas|)_ and it got pretty slow after not that much time.

This version instead uses the fact that all segments lie on a grid and can only be of three kinds (going down, down left or down right) and stores them in a "2d integer hashmap" (in js this is just an object indexed by `<x>,<y>` for example `0,0` or `-15,7`).

Another improvement is that the screen is redrawn only when considered `dirty` (the update functions sets this to true after modifying the world state).