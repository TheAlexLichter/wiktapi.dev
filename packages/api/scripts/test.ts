import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const stream = createReadStream("../data/jsonl/cs.jsonl", { encoding: "utf8" });

const rl = createInterface({
    input: stream,
    crlfDelay: Infinity,
});

for await (const line of rl) {
    if (!line.trim()) {
        continue;
    }

    const obj = JSON.parse(line);

    if (obj["word"] === "placka") {
        console.log(line);
        break;
    }
}
