import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { MateriaEstudiantesComponent } from './materia-estudiantes.component';

describe('MateriaEstudiantesComponent', () => {
  let component: MateriaEstudiantesComponent;
  let fixture: ComponentFixture<MateriaEstudiantesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ MateriaEstudiantesComponent ],
      imports: [IonicModule.forRoot()]
    }).compileComponents();

    fixture = TestBed.createComponent(MateriaEstudiantesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
