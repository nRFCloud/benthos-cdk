import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

import { Readable } from "node:stream";

const _dirname = new URL(".", import.meta.url).pathname;
export const benthosPath = `${_dirname}../benthos-runtime`;

export async function getInstall(
    ghRepo: string,
    version: string,
    arch: string,
): Promise<{ archivePath: string; checksumPath: string }> {
    const paths = await createBenthosRuntimeDirectories(ghRepo, version, arch);
    if (await verifyChecksum(version, arch, paths)) {
        console.log(`Benthos runtime version ${version} already downloaded`);
        return paths;
    }

    await get(ghRepo, version, arch, paths);
    console.log(`Downloaded Benthos runtime version ${version} to ${paths.archivePath}`);

    if (!(await verifyChecksum(version, arch, paths))) {
        throw new Error(`Checksum verification failed for version ${version}`);
    }

    console.log(`Checksum verification passed for version ${version}`);
    return paths;
}

// async function extractArchive(paths: { archivePath: string, runtimeDir: string }) {
//     unzip()
// }

async function createBenthosRuntimeDirectories(ghRepo: string, version: string, arch: string): Promise<{
    archivePath: string;
    checksumPath: string;
}> {
    const id = `${ghRepo}_${version}_${arch}`.replace(/\//g, "_");
    const path = `${benthosPath}/${id}`;
    await mkdir(path, { recursive: true });

    return {
        archivePath: `${path}/benthos.zip`,
        checksumPath: `${path}/checksums.txt`,
    };
}

async function verifyChecksum(
    version: string,
    arch: string,
    paths: { archivePath: string; checksumPath: string },
): Promise<boolean> {
    if (!existsSync(paths.archivePath) || !existsSync(paths.checksumPath)) {
        return false;
    }

    const hash = createHash("sha256");
    const archiveStream = createReadStream(paths.archivePath);

    await pipeline(archiveStream, hash);

    const checksum = hash.digest("hex");
    const fileChecksums = await getChecksums(paths.checksumPath);
    const fileChecksum = fileChecksums[`benthos-lambda-al2_${version}_linux_${arch}.zip`];

    return checksum === fileChecksum;
}

async function getChecksums(checksumPath: string) {
    const checksumFile = await readFile(checksumPath, "utf-8");
    return Object.fromEntries(checksumFile.split("\n").map(line => [line.split(" ")[2], line.split(" ")[0]]));
}

async function get(
    ghRepo: string,
    version: string,
    arch: string,
    paths: { archivePath: string; checksumPath: string },
) {
    const { archivePath, checksumPath } = paths;
    const { archive: archiveUrl, checksums: checksumsUrl } = buildUrl(ghRepo, version, arch);
    const runtimeArchiveRequest = await fetch(archiveUrl, {
        method: "GET",
        redirect: "follow",
    });

    if (!runtimeArchiveRequest.ok) {
        throw new Error(`Failed to download Benthos runtime archive: ${runtimeArchiveRequest.statusText}`);
    }

    const archiveWriteStream = createWriteStream(archivePath);

    await pipeline(
        Readable.fromWeb(runtimeArchiveRequest.body! as import("stream/web").ReadableStream),
        archiveWriteStream,
    );

    const checksumsRequest = await fetch(checksumsUrl, {
        method: "GET",
        redirect: "follow",
    });

    const checksumsWriteStream = createWriteStream(checksumPath);
    await pipeline(
        Readable.fromWeb(checksumsRequest.body! as import("stream/web").ReadableStream),
        checksumsWriteStream,
    );
}

function buildUrl(ghRepo: string, version: string, arch: string): { archive: string; checksums: string } {
    return {
        archive:
            `https://github.com/${ghRepo}/releases/download/v${version}/benthos-lambda-al2_${version}_linux_${arch}.zip`,
        checksums: `https://github.com/${ghRepo}/releases/download/v${version}/benthos_${version}_checksums.txt`,
    };
}
