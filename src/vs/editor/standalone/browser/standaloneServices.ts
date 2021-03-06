/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Disposable } from 'vs/base/common/lifecycle';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ContextMenuService } from 'vs/platform/contextview/browser/contextMenuService';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { ContextViewService } from 'vs/platform/contextview/browser/contextViewService';
import { createDecorator, IInstantiationService, ServiceIdentifier } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationService } from 'vs/platform/instantiation/common/instantiationService';
import { ServiceCollection } from 'vs/platform/instantiation/common/serviceCollection';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { MarkerService } from 'vs/platform/markers/common/markerService';
import { IMarkerService } from 'vs/platform/markers/common/markers';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IStorageService, NullStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { ICodeEditorService } from 'vs/editor/browser/services/codeEditorService';
import { IEditorWorkerService } from 'vs/editor/common/services/editorWorkerService';
import { EditorWorkerServiceImpl } from 'vs/editor/common/services/editorWorkerServiceImpl';
import { ITextResourceConfigurationService } from 'vs/editor/common/services/resourceConfiguration';
import { IModeService } from 'vs/editor/common/services/modeService';
import { ModeServiceImpl } from 'vs/editor/common/services/modeServiceImpl';
import { IModelService } from 'vs/editor/common/services/modelService';
import { ModelServiceImpl } from 'vs/editor/common/services/modelServiceImpl';
import { CodeEditorServiceImpl } from 'vs/editor/browser/services/codeEditorServiceImpl';
import {
	SimpleConfigurationService, SimpleResourceConfigurationService, SimpleMenuService,
	SimpleProgressService, StandaloneCommandService, StandaloneKeybindingService, SimpleNotificationService,
	StandaloneTelemetryService, SimpleWorkspaceContextService, SimpleConfirmationService
} from 'vs/editor/standalone/browser/simpleServices';
import { ContextKeyService } from 'vs/platform/contextkey/browser/contextKeyService';
import { IMenuService } from 'vs/platform/actions/common/actions';
import { IStandaloneThemeService } from 'vs/editor/standalone/common/standaloneThemeService';
import { StandaloneThemeServiceImpl } from 'vs/editor/standalone/browser/standaloneThemeServiceImpl';
import { ILogService, NullLogService } from 'vs/platform/log/common/log';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConfirmationService } from 'vs/platform/dialogs/common/dialogs';

export interface IEditorContextViewService extends IContextViewService {
	dispose(): void;
	setContainer(domNode: HTMLElement): void;
}

export interface IEditorOverrideServices {
	[index: string]: any;
}

export module StaticServices {

	const _serviceCollection = new ServiceCollection();

	export class LazyStaticService<T> {
		private _serviceId: ServiceIdentifier<T>;
		private _factory: (overrides: IEditorOverrideServices) => T;
		private _value: T;

		public get id() { return this._serviceId; }

		constructor(serviceId: ServiceIdentifier<T>, factory: (overrides: IEditorOverrideServices) => T) {
			this._serviceId = serviceId;
			this._factory = factory;
			this._value = null;
		}

		public get(overrides?: IEditorOverrideServices): T {
			if (!this._value) {
				if (overrides) {
					this._value = overrides[this._serviceId.toString()];
				}
				if (!this._value) {
					this._value = this._factory(overrides);
				}
				if (!this._value) {
					throw new Error('Service ' + this._serviceId + ' is missing!');
				}
				_serviceCollection.set(this._serviceId, this._value);
			}
			return this._value;
		}
	}

	let _all: LazyStaticService<any>[] = [];

	function define<T>(serviceId: ServiceIdentifier<T>, factory: (overrides: IEditorOverrideServices) => T): LazyStaticService<T> {
		let r = new LazyStaticService(serviceId, factory);
		_all.push(r);
		return r;
	}

	export function init(overrides: IEditorOverrideServices): [ServiceCollection, IInstantiationService] {
		// Create a fresh service collection
		let result = new ServiceCollection();

		// Initialize the service collection with the overrides
		for (let serviceId in overrides) {
			if (overrides.hasOwnProperty(serviceId)) {
				result.set(createDecorator(serviceId), overrides[serviceId]);
			}
		}

		// Make sure the same static services are present in all service collections
		_all.forEach(service => result.set(service.id, service.get(overrides)));

		// Ensure the collection gets the correct instantiation service
		let instantiationService = new InstantiationService(result, true);
		result.set(IInstantiationService, instantiationService);

		return [result, instantiationService];
	}

	export const instantiationService = define<IInstantiationService>(IInstantiationService, () => new InstantiationService(_serviceCollection, true));

	const configurationServiceImpl = new SimpleConfigurationService();
	export const configurationService = define(IConfigurationService, () => configurationServiceImpl);

	export const resourceConfigurationService = define(ITextResourceConfigurationService, () => new SimpleResourceConfigurationService(configurationServiceImpl));

	export const contextService = define(IWorkspaceContextService, () => new SimpleWorkspaceContextService());

	export const telemetryService = define(ITelemetryService, () => new StandaloneTelemetryService());

	export const confirmationService = define(IConfirmationService, () => new SimpleConfirmationService());

	export const notificationService = define(INotificationService, () => new SimpleNotificationService());

	export const markerService = define(IMarkerService, () => new MarkerService());

	export const modeService = define(IModeService, (o) => new ModeServiceImpl());

	export const modelService = define(IModelService, (o) => new ModelServiceImpl(markerService.get(o), configurationService.get(o)));

	export const editorWorkerService = define(IEditorWorkerService, (o) => new EditorWorkerServiceImpl(modelService.get(o), resourceConfigurationService.get(o)));

	export const standaloneThemeService = define(IStandaloneThemeService, () => new StandaloneThemeServiceImpl());

	export const codeEditorService = define(ICodeEditorService, (o) => new CodeEditorServiceImpl(standaloneThemeService.get(o)));

	export const progressService = define(IProgressService, () => new SimpleProgressService());

	export const storageService = define(IStorageService, () => NullStorageService);

	export const logService = define(ILogService, () => new NullLogService());

}

export class DynamicStandaloneServices extends Disposable {

	private _serviceCollection: ServiceCollection;
	private _instantiationService: IInstantiationService;

	constructor(domElement: HTMLElement, overrides: IEditorOverrideServices) {
		super();

		const [_serviceCollection, _instantiationService] = StaticServices.init(overrides);
		this._serviceCollection = _serviceCollection;
		this._instantiationService = _instantiationService;

		const configurationService = this.get(IConfigurationService);
		const notificationService = this.get(INotificationService);
		const telemetryService = this.get(ITelemetryService);

		let ensure = <T>(serviceId: ServiceIdentifier<T>, factory: () => T): T => {
			let value: T = null;
			if (overrides) {
				value = overrides[serviceId.toString()];
			}
			if (!value) {
				value = factory();
			}
			this._serviceCollection.set(serviceId, value);
			return value;
		};

		let contextKeyService = ensure(IContextKeyService, () => this._register(new ContextKeyService(configurationService)));

		let commandService = ensure(ICommandService, () => new StandaloneCommandService(this._instantiationService));

		ensure(IKeybindingService, () => this._register(new StandaloneKeybindingService(contextKeyService, commandService, telemetryService, notificationService, domElement)));

		let contextViewService = ensure(IContextViewService, () => this._register(new ContextViewService(domElement, telemetryService, new NullLogService())));

		ensure(IContextMenuService, () => this._register(new ContextMenuService(domElement, telemetryService, notificationService, contextViewService)));

		ensure(IMenuService, () => new SimpleMenuService(commandService));
	}

	public get<T>(serviceId: ServiceIdentifier<T>): T {
		let r = <T>this._serviceCollection.get(serviceId);
		if (!r) {
			throw new Error('Missing service ' + serviceId);
		}
		return r;
	}

	public set<T>(serviceId: ServiceIdentifier<T>, instance: T): void {
		this._serviceCollection.set(serviceId, instance);
	}

	public has<T>(serviceId: ServiceIdentifier<T>): boolean {
		return this._serviceCollection.has(serviceId);
	}
}
