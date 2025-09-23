import { Injectable } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { SDK_CONTRACT_KEY, SdkContractMetadata } from '../../src/common/decorators/sdk-contract.decorator';

export interface ExtractedContract {
  controller: string;
  method: string;
  httpMethod: string;
  path: string;
  contractMetadata: SdkContractMetadata;
}

@Injectable()
export class ContractExtractorService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  extractContracts(): ExtractedContract[] {
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
        (name) => name !== 'constructor' && typeof prototype[name] === 'function'
      );

      for (const methodName of methodNames) {
        const methodRef = prototype[methodName];

        // Extract SDK contract metadata
        const contractMetadata = this.reflector.get<SdkContractMetadata>(
          SDK_CONTRACT_KEY,
          methodRef
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
    // Check for HTTP method decorators using proper metadata keys
    const httpMethods = [
      { method: 'GET', key: '__routeArguments__' },
      { method: 'POST', key: '__routeArguments__' },
      { method: 'PUT', key: '__routeArguments__' },
      { method: 'PATCH', key: '__routeArguments__' },
      { method: 'DELETE', key: '__routeArguments__' },
    ];

    // Try to get method from route arguments metadata
    const routeArgs = this.reflector.get('__routeArguments__', methodRef);
    if (routeArgs && routeArgs[2] && routeArgs[2].method) {
      return routeArgs[2].method;
    }

    // Fallback: check method metadata directly
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      if (this.reflector.get(method.toLowerCase(), methodRef)) {
        return method;
      }
    }

    return 'UNKNOWN';
  }

  private getPath(controllerWrapper: InstanceWrapper, methodRef: Function): string {
    const { metatype } = controllerWrapper;

    // Get controller path
    const controllerPath = this.reflector.get<string>('path', metatype!) || '';

    // Get method path
    const methodPath = this.reflector.get<string>('path', methodRef) || '';

    // Combine paths
    const fullPath = `${controllerPath}${methodPath}`.replace(/\/+/g, '/');
    return fullPath.startsWith('/') ? fullPath : `/${fullPath}`;
  }
}