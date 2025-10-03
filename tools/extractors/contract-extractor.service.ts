import { Injectable } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import {
  SDK_CONTRACT_KEY,
  SdkContractMetadata,
} from '../../src/common/decorators/sdk-contract.decorator';
import { TypeExtractorService } from './type-extractor.service';
import { PlatformRegistry } from '../../src/platforms/services/platform-registry.service';

export interface ExtractedContract {
  controller: string;
  method: string;
  httpMethod: string;
  path: string;
  contractMetadata: SdkContractMetadata;
  typeDefinitions?: Record<string, string>; // Include all type definitions inline
  platformMetadata?: Record<string, any>; // Platform-specific metadata
}

@Injectable()
export class ContractExtractorService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly platformRegistry: PlatformRegistry,
  ) {}

  async extractContracts(): Promise<ExtractedContract[]> {
    const contracts = this.extractContractsBasic();

    // Extract all type definitions and include them in contracts
    const allTypeNames = this.getAllReferencedTypes(contracts);
    const typeExtractor = new TypeExtractorService();
    const extractedTypes = await typeExtractor.extractTypes(allTypeNames);

    // Create type definitions map
    const typeDefinitions: Record<string, string> = {};
    extractedTypes.forEach((type) => {
      typeDefinitions[type.name] = type.definition;
    });

    // Extract platform metadata from registry
    const platformMetadata = this.platformRegistry.getAllPlatformMetadata();

    // Add type definitions and platform metadata to first contract (so they're available to all generators)
    if (contracts.length > 0) {
      contracts[0].typeDefinitions = typeDefinitions;
      contracts[0].platformMetadata = platformMetadata;
    }

    return contracts;
  }

  private getAllReferencedTypes(contracts: ExtractedContract[]): string[] {
    const typeNames = new Set<string>();

    contracts.forEach((contract) => {
      if (contract.contractMetadata.inputType) {
        typeNames.add(contract.contractMetadata.inputType);
      }
      if (contract.contractMetadata.outputType) {
        typeNames.add(contract.contractMetadata.outputType);
      }
    });

    return Array.from(typeNames);
  }

  private extractContractsBasic(): ExtractedContract[] {
    const contracts: ExtractedContract[] = [];

    // Get all controllers
    const controllers = this.discoveryService.getControllers();

    for (const controllerWrapper of controllers) {
      const { instance, metatype } = controllerWrapper;

      if (!instance || !metatype) continue;

      const controllerName = metatype.name;
      const prototype = Object.getPrototypeOf(instance);

      // Get all methods of the controller
      const methodNames = Object.getOwnPropertyNames(prototype).filter(
        (name) =>
          name !== 'constructor' && typeof prototype[name] === 'function',
      );

      for (const methodName of methodNames) {
        const methodRef = prototype[methodName];

        // Extract SDK contract metadata
        const contractMetadata = this.reflector.get<SdkContractMetadata>(
          SDK_CONTRACT_KEY,
          methodRef,
        );

        if (contractMetadata) {
          // Get HTTP method and path from NestJS metadata
          const httpMethod = this.getHttpMethod(methodRef);
          const path = this.getPath(controllerWrapper, methodRef);

          contracts.push({
            controller: controllerName,
            method: methodName,
            httpMethod,
            path,
            contractMetadata,
          });
        }
      }
    }

    return contracts;
  }

  private getHttpMethod(methodRef: Function): string {
    // Check for NestJS HTTP method decorators using the correct metadata keys
    const httpMethods = [
      { method: 'GET', keys: ['method', '__routeArguments__'] },
      { method: 'POST', keys: ['method', '__routeArguments__'] },
      { method: 'PUT', keys: ['method', '__routeArguments__'] },
      { method: 'PATCH', keys: ['method', '__routeArguments__'] },
      { method: 'DELETE', keys: ['method', '__routeArguments__'] },
    ];

    // Check route arguments metadata first
    const routeArgs = this.reflector.get('__routeArguments__', methodRef);
    if (routeArgs && routeArgs.length > 0) {
      // Route arguments array contains method info
      for (const arg of routeArgs) {
        if (arg && typeof arg === 'object' && arg.method) {
          return arg.method.toUpperCase();
        }
      }
    }

    // Check method metadata directly
    const methodMetadata = this.reflector.get('method', methodRef);
    if (methodMetadata && typeof methodMetadata === 'string') {
      return methodMetadata.toUpperCase();
    }

    // Fallback: check for individual HTTP method keys
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      if (this.reflector.get(method, methodRef)) {
        return method.toUpperCase();
      }
    }

    // Final fallback: infer from method name
    const methodName = methodRef.name.toLowerCase();
    if (
      methodName.includes('create') ||
      methodName.includes('add') ||
      methodName.includes('send') ||
      methodName.includes('retry')
    )
      return 'POST';
    if (methodName.includes('update') || methodName.includes('edit'))
      return 'PATCH';
    if (
      methodName.includes('delete') ||
      methodName.includes('remove') ||
      methodName.includes('revoke')
    )
      return 'DELETE';
    if (
      methodName.includes('find') ||
      methodName.includes('get') ||
      methodName.includes('list') ||
      methodName.includes('status')
    )
      return 'GET';

    return 'GET'; // Default to GET instead of UNKNOWN
  }

  private getPath(
    controllerWrapper: InstanceWrapper,
    methodRef: Function,
  ): string {
    const { metatype } = controllerWrapper;

    // Get controller path
    const controllerPath = this.reflector.get<string>('path', metatype!) || '';

    // Get method path
    const methodPath = this.reflector.get<string>('path', methodRef) || '';

    // Combine paths with proper slash handling
    let fullPath = controllerPath;
    if (methodPath) {
      // Ensure there's a slash between controller and method paths
      if (!controllerPath.endsWith('/') && !methodPath.startsWith('/')) {
        fullPath += '/';
      }
      fullPath += methodPath;
    }

    // Clean up multiple slashes and ensure leading slash
    fullPath = fullPath.replace(/\/+/g, '/');
    return fullPath.startsWith('/') ? fullPath : `/${fullPath}`;
  }
}
