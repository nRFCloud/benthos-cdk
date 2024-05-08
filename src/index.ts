import {Architecture, Code, Function, FunctionProps, LayerVersion, Runtime} from "aws-cdk-lib/aws-lambda";
import {Construct} from "constructs";
import {randomUUID} from "crypto";
import {mkdirSync, writeFileSync} from "fs";
import {tmpdir} from "os";
import {getInstallSync} from "./install.cjs";

const DEFAULT_GH_REPO = "benthosdev/benthos";
const DEFAULT_VERSION = "4.27.0";
const DEFAULT_ARCH = "arm64";

export interface BenthoLambdaProps extends Omit<FunctionProps, "code" | "runtime" | "architecture" | "handler"> {
    ghRepo?: string;
    version?: string;
    configLayerContent?: Code;
    config?: string;
    // arch?: "arm64" | "amd64";
}

export class BenthosLambda extends Function {


    private static _benthosArtifactAssetMap: Map<string, Code> = new Map<string, Code>();
    protected static getBenthosArtifactAsset(ghRepo: string, version: string, arch: string): Code {
        const id = `${ghRepo}_${version}_${arch}`.replace(/\//g, "_");
        if (!this._benthosArtifactAssetMap.has(id)) {
            const { archivePath } = getInstallSync(ghRepo, version, arch);
            this._benthosArtifactAssetMap.set(id, Code.fromAsset(archivePath));
        }
        return this._benthosArtifactAssetMap.get(id)!;
    }

    constructor(scope: Construct, id: string, props: BenthoLambdaProps) {
        super(scope, id, {
            ...props,
            handler: "benthos-lambda",
            code: BenthosLambda.getBenthosArtifactAsset(
                props.ghRepo ?? DEFAULT_GH_REPO,
                props.version ?? DEFAULT_VERSION,
                DEFAULT_ARCH,
            ),
            runtime: Runtime.PROVIDED_AL2023,
            architecture: Architecture.ARM_64,
        });

        const configLayer = new LayerVersion(this, "config-layer", {
            code: props.configLayerContent ?? this.archiveConfigString(props.config ?? ""),
            compatibleRuntimes: [Runtime.PROVIDED_AL2023],
            description: "Benthos Lambda config layer",
            compatibleArchitectures: [Architecture.ARM_64],
        });

        this.addLayers(configLayer);
    }

    private archiveConfigString(config: string): Code {
        const tmpDirPath = `${tmpdir()}/benthos-lambda-config-${randomUUID()}`;
        // create temporary directory
        mkdirSync(tmpDirPath, { recursive: true });
        // write config to file
        const configPath = `${tmpDirPath}/etc/benthos.yaml`;
        writeFileSync(configPath, config);
        // create layer
        return Code.fromAsset(tmpDirPath);
    }
}
