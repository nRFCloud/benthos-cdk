# @nrfcloud/cdktf-aws-adaptor
***A compatibility layer for using the CDK for Terraform with AWS CDK constructs***

### Why?
The CDK for Terraform is a great tool for managing infrastructure, but it lacks the ecosystem of constructs that the AWS CDK has.
This tool allows you to use the excellent aws-cdk-lib construct library, while also getting access to the benefits of terraform.
Think of provisioning a CockroachDB cloud cluster and connecting it to a lambda using the high level nodejs function construct in the same stack.

#### But isn't there already an adaptor?
[Yes](https://github.com/hashicorp/cdktf-aws-cdk), but it's in technical preview and missing many essential features.
It also doesn't seem to be actively maintained.


### Supported Features
* Bidirectional references between AWS CDK and CDK for Terraform constructs
* Interstack referencing
* Dependency ordering compatibility
* Cloudformation intrinsics
* Assets

#### Caveats
* References to AWS CDK constructs only work within the scope of adaptor classes
* AWS CDK aspects are not supported
* Custom resources are not supported

## Basic Usage

Essentially, just use the provided `AwsTerraformAdaptorStack` class as your base stack class instead of `TerraformStack`
```typescript
import {AwsTerraformAdaptorStack} from "./cdk-adaptor-stack";
import {Bucket} from "aws-cdk-lib";
import {S3Bucket} from "@cdktf/provider-aws/lib/s3-bucket/index.js";
import {S3BucketObject} from "@cdktf/provider-aws/lib/s3-bucket-object";

class MyStack extends AwsTerraformAdaptorStack {
    constructor(scope: Construct, id: string, region: string) {
        super(scope, id, region);

        // You can instantiate AWS CDK constructs as normal
        const bucket = new Bucket(this, 'MyBucket', {
            bucket: 'my-bucket',
        });

        // You can also instantiate CDK for Terraform constructs
        // Bidirectional references between the two are automatically created
        const tfBucket = new S3BucketObject(this, 'MyTfBucket', {
            bucket: bucket.bucketName,
            key: 'my-tf-bucket',
            source: 'my-tf-bucket',
        });
    }
}
```

## Compatibility
Internally, the adaptor tries to use the CloudControl api for 1-1 compatibility with Cloudformation.
In some cases this is enough, but in many others explicit resource mappings are required.
The adaptor ships with a good variety of these mappings, but it is not exhaustive.

If you encounter an error like `No resource mapping found for <resource type>`, you can add a mapping for it like so:
```typescript
// Map between a L1 Cloudformation construct and a CDK for Terraform construct
registerMappingTyped(CfnBucketPolicy, S3BucketPolicy, {
    resource(scope, id, props) {
        return new S3BucketPolicy(
            scope,
            id,
            deleteUndefinedKeys({
                // ALL keys of the provided construct must be mapped
                policy: Fn.jsonencode(props.PolicyDocument),
                bucket: props.Bucket,
            }),
        );
    },
    attributes: {
        // ALL attributes of the provided construct must be mapped
        Ref: (resource) => resource.id,
    },
});
```

### Cloudcontrol Wonkiness
The Cloudcontrol api is theoretically a stable crud API 1-1 with cloudformation, but it in practice it has some quirks.
Update operations in particular seems to break with alarming regularity, so explicit mappings are preferred, especially for complex resources.
