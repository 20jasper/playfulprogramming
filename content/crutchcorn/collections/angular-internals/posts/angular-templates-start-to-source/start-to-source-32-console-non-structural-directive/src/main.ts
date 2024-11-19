import "zone.js";
import { bootstrapApplication } from "@angular/platform-browser";

import {
	Component,
	ViewContainerRef,
	OnInit,
	Input,
	TemplateRef,
	Directive,
} from "@angular/core";

@Directive({
	selector: "[consoleThing]",
	standalone: true,
})
export class ConsoleThingDirective {
	@Input() set consoleThing(val: string) {
		if (this.warn) {
			console.warn(val);
			return;
		}
		console.log(val);
	}

	@Input() warn: boolean = false;
}

@Component({
	selector: "my-app",
	standalone: true,
	imports: [ConsoleThingDirective],
	template: `
		<ng-template
			[consoleThing]="
				'This is a warning from the 👻 of code future, refactor this please'
			"
			[warn]="true"
		></ng-template>
		<p>Check the console</p>
	`,
})
export class AppComponent {}

bootstrapApplication(AppComponent);
