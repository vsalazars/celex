--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: diasemana; Type: TYPE; Schema: public; Owner: vsalazars
--

CREATE TYPE public.diasemana AS ENUM (
    'lunes',
    'martes',
    'miercoles',
    'jueves',
    'viernes',
    'sabado',
    'domingo'
);


ALTER TYPE public.diasemana OWNER TO vsalazars;

--
-- Name: idioma; Type: TYPE; Schema: public; Owner: vsalazars
--

CREATE TYPE public.idioma AS ENUM (
    'ingles',
    'frances',
    'aleman',
    'italiano',
    'portugues'
);


ALTER TYPE public.idioma OWNER TO vsalazars;

--
-- Name: inscripciontipo; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.inscripciontipo AS ENUM (
    'pago',
    'exencion'
);


ALTER TYPE public.inscripciontipo OWNER TO postgres;

--
-- Name: modalidad; Type: TYPE; Schema: public; Owner: vsalazars
--

CREATE TYPE public.modalidad AS ENUM (
    'intensivo',
    'sabatino',
    'semestral'
);


ALTER TYPE public.modalidad OWNER TO vsalazars;

--
-- Name: modalidadasistencia; Type: TYPE; Schema: public; Owner: vsalazars
--

CREATE TYPE public.modalidadasistencia AS ENUM (
    'presencial',
    'virtual'
);


ALTER TYPE public.modalidadasistencia OWNER TO vsalazars;

--
-- Name: nivel; Type: TYPE; Schema: public; Owner: vsalazars
--

CREATE TYPE public.nivel AS ENUM (
    'A1',
    'A2',
    'B1',
    'B2',
    'C1',
    'C2'
);


ALTER TYPE public.nivel OWNER TO vsalazars;

--
-- Name: turno; Type: TYPE; Schema: public; Owner: vsalazars
--

CREATE TYPE public.turno AS ENUM (
    'matutino',
    'vespertino',
    'mixto'
);


ALTER TYPE public.turno OWNER TO vsalazars;

--
-- Name: userrole; Type: TYPE; Schema: public; Owner: vsalazars
--

CREATE TYPE public.userrole AS ENUM (
    'student',
    'teacher',
    'coordinator',
    'superuser'
);


ALTER TYPE public.userrole OWNER TO vsalazars;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asistencia_registro; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asistencia_registro (
    id integer NOT NULL,
    sesion_id integer NOT NULL,
    inscripcion_id integer NOT NULL,
    estado text DEFAULT 'presente'::text NOT NULL,
    nota text,
    marcado_por_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.asistencia_registro OWNER TO postgres;

--
-- Name: asistencia_registro_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asistencia_registro_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asistencia_registro_id_seq OWNER TO postgres;

--
-- Name: asistencia_registro_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asistencia_registro_id_seq OWNED BY public.asistencia_registro.id;


--
-- Name: asistencia_sesion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asistencia_sesion (
    id integer NOT NULL,
    ciclo_id integer NOT NULL,
    fecha date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.asistencia_sesion OWNER TO postgres;

--
-- Name: asistencia_sesion_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asistencia_sesion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asistencia_sesion_id_seq OWNER TO postgres;

--
-- Name: asistencia_sesion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asistencia_sesion_id_seq OWNED BY public.asistencia_sesion.id;


--
-- Name: ciclos; Type: TABLE; Schema: public; Owner: vsalazars
--

CREATE TABLE public.ciclos (
    id integer NOT NULL,
    codigo character varying(120) NOT NULL,
    modalidad public.modalidad NOT NULL,
    turno public.turno NOT NULL,
    insc_inicio date NOT NULL,
    insc_fin date NOT NULL,
    curso_inicio date NOT NULL,
    curso_fin date NOT NULL,
    examen_mt date,
    examen_final date,
    notas text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    idioma public.idioma NOT NULL,
    cupo_total integer NOT NULL,
    nivel public.nivel NOT NULL,
    dias text[] DEFAULT '{}'::text[],
    hora_inicio time without time zone DEFAULT '00:00:00'::time without time zone,
    hora_fin time without time zone DEFAULT '23:59:00'::time without time zone,
    modalidad_asistencia public.modalidadasistencia DEFAULT 'presencial'::public.modalidadasistencia NOT NULL,
    aula character varying(120),
    docente_id integer,
    CONSTRAINT ck_ciclos_cupo_total_nonneg CHECK ((cupo_total >= 0))
);


ALTER TABLE public.ciclos OWNER TO vsalazars;

--
-- Name: ciclos_id_seq; Type: SEQUENCE; Schema: public; Owner: vsalazars
--

CREATE SEQUENCE public.ciclos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ciclos_id_seq OWNER TO vsalazars;

--
-- Name: ciclos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vsalazars
--

ALTER SEQUENCE public.ciclos_id_seq OWNED BY public.ciclos.id;


--
-- Name: evaluaciones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evaluaciones (
    id integer NOT NULL,
    inscripcion_id integer NOT NULL,
    ciclo_id integer NOT NULL,
    medio_examen integer,
    medio_continua integer,
    final_examen integer,
    final_continua integer,
    final_tarea integer,
    subtotal_medio integer DEFAULT 0 NOT NULL,
    subtotal_final integer DEFAULT 0 NOT NULL,
    promedio_final numeric(5,2) DEFAULT 0 NOT NULL,
    updated_by_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT evaluaciones_final_continua_check CHECK (((final_continua >= 0) AND (final_continua <= 20))),
    CONSTRAINT evaluaciones_final_examen_check CHECK (((final_examen >= 0) AND (final_examen <= 60))),
    CONSTRAINT evaluaciones_final_tarea_check CHECK (((final_tarea >= 0) AND (final_tarea <= 20))),
    CONSTRAINT evaluaciones_medio_continua_check CHECK (((medio_continua >= 0) AND (medio_continua <= 20))),
    CONSTRAINT evaluaciones_medio_examen_check CHECK (((medio_examen >= 0) AND (medio_examen <= 80)))
);


ALTER TABLE public.evaluaciones OWNER TO postgres;

--
-- Name: evaluaciones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.evaluaciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.evaluaciones_id_seq OWNER TO postgres;

--
-- Name: evaluaciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.evaluaciones_id_seq OWNED BY public.evaluaciones.id;


--
-- Name: grupos; Type: TABLE; Schema: public; Owner: vsalazars
--

CREATE TABLE public.grupos (
    id integer NOT NULL,
    codigo character varying(64) NOT NULL,
    ciclo_id integer NOT NULL,
    cupo_total integer NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    CONSTRAINT ck_grupos_cupo_total_nonneg CHECK ((cupo_total >= 0))
);


ALTER TABLE public.grupos OWNER TO vsalazars;

--
-- Name: grupos_id_seq; Type: SEQUENCE; Schema: public; Owner: vsalazars
--

CREATE SEQUENCE public.grupos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.grupos_id_seq OWNER TO vsalazars;

--
-- Name: grupos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vsalazars
--

ALTER SEQUENCE public.grupos_id_seq OWNED BY public.grupos.id;


--
-- Name: inscripciones; Type: TABLE; Schema: public; Owner: vsalazars
--

CREATE TABLE public.inscripciones (
    id integer NOT NULL,
    alumno_id integer NOT NULL,
    ciclo_id integer NOT NULL,
    status character varying(20) DEFAULT 'registrada'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    referencia character varying(50),
    importe_centavos integer,
    comprobante_path character varying(255),
    comprobante_mime character varying(100),
    comprobante_size integer,
    alumno_is_ipn boolean DEFAULT false NOT NULL,
    comprobante_estudios_path character varying(255),
    comprobante_estudios_mime character varying(100),
    comprobante_estudios_size integer,
    tipo public.inscripciontipo DEFAULT 'pago'::public.inscripciontipo NOT NULL,
    comprobante_exencion_path character varying(255),
    comprobante_exencion_mime character varying(100),
    comprobante_exencion_size integer,
    validated_by_id integer,
    validated_at timestamp with time zone,
    validation_notes text,
    fecha_pago date,
    rechazo_motivo text,
    CONSTRAINT ck_insc_estudios_si_ipn CHECK (((tipo <> 'pago'::public.inscripciontipo) OR (NOT alumno_is_ipn) OR (comprobante_estudios_path IS NOT NULL))),
    CONSTRAINT ck_insc_exencion_requiere_comprobante CHECK (((tipo <> 'exencion'::public.inscripciontipo) OR (comprobante_exencion_path IS NOT NULL)))
);


ALTER TABLE public.inscripciones OWNER TO vsalazars;

--
-- Name: inscripciones_id_seq; Type: SEQUENCE; Schema: public; Owner: vsalazars
--

CREATE SEQUENCE public.inscripciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inscripciones_id_seq OWNER TO vsalazars;

--
-- Name: inscripciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vsalazars
--

ALTER SEQUENCE public.inscripciones_id_seq OWNED BY public.inscripciones.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: vsalazars
--

CREATE TABLE public.users (
    id integer NOT NULL,
    first_name character varying(120) NOT NULL,
    last_name character varying(160) NOT NULL,
    email character varying(255) NOT NULL,
    email_verified boolean,
    hashed_password character varying(255) NOT NULL,
    is_ipn boolean,
    boleta character varying(10),
    curp character varying(18) NOT NULL,
    role public.userrole NOT NULL,
    is_active boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone
);


ALTER TABLE public.users OWNER TO vsalazars;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: vsalazars
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO vsalazars;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: vsalazars
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: asistencia_registro id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro ALTER COLUMN id SET DEFAULT nextval('public.asistencia_registro_id_seq'::regclass);


--
-- Name: asistencia_sesion id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_sesion ALTER COLUMN id SET DEFAULT nextval('public.asistencia_sesion_id_seq'::regclass);


--
-- Name: ciclos id; Type: DEFAULT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.ciclos ALTER COLUMN id SET DEFAULT nextval('public.ciclos_id_seq'::regclass);


--
-- Name: evaluaciones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones ALTER COLUMN id SET DEFAULT nextval('public.evaluaciones_id_seq'::regclass);


--
-- Name: grupos id; Type: DEFAULT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.grupos ALTER COLUMN id SET DEFAULT nextval('public.grupos_id_seq'::regclass);


--
-- Name: inscripciones id; Type: DEFAULT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.inscripciones ALTER COLUMN id SET DEFAULT nextval('public.inscripciones_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: asistencia_registro asistencia_registro_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT asistencia_registro_pkey PRIMARY KEY (id);


--
-- Name: asistencia_sesion asistencia_sesion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_sesion
    ADD CONSTRAINT asistencia_sesion_pkey PRIMARY KEY (id);


--
-- Name: ciclos ciclos_pkey; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.ciclos
    ADD CONSTRAINT ciclos_pkey PRIMARY KEY (id);


--
-- Name: evaluaciones evaluaciones_inscripcion_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_inscripcion_id_key UNIQUE (inscripcion_id);


--
-- Name: evaluaciones evaluaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT evaluaciones_pkey PRIMARY KEY (id);


--
-- Name: grupos grupos_pkey; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_pkey PRIMARY KEY (id);


--
-- Name: inscripciones inscripciones_pkey; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_pkey PRIMARY KEY (id);


--
-- Name: asistencia_registro uq_asistencia_registro_sesion_inscripcion; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT uq_asistencia_registro_sesion_inscripcion UNIQUE (sesion_id, inscripcion_id);


--
-- Name: asistencia_sesion uq_asistencia_sesion_ciclo_fecha; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_sesion
    ADD CONSTRAINT uq_asistencia_sesion_ciclo_fecha UNIQUE (ciclo_id, fecha);


--
-- Name: ciclos uq_ciclos_codigo; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.ciclos
    ADD CONSTRAINT uq_ciclos_codigo UNIQUE (codigo);


--
-- Name: grupos uq_grupos_ciclo_codigo; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT uq_grupos_ciclo_codigo UNIQUE (ciclo_id, codigo);


--
-- Name: inscripciones uq_inscripcion_alumno_ciclo; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT uq_inscripcion_alumno_ciclo UNIQUE (alumno_id, ciclo_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_asistencia_registro_inscripcion_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_asistencia_registro_inscripcion_id ON public.asistencia_registro USING btree (inscripcion_id);


--
-- Name: ix_asistencia_registro_sesion_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_asistencia_registro_sesion_id ON public.asistencia_registro USING btree (sesion_id);


--
-- Name: ix_asistencia_sesion_ciclo_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_asistencia_sesion_ciclo_id ON public.asistencia_sesion USING btree (ciclo_id);


--
-- Name: ix_asistencia_sesion_fecha; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_asistencia_sesion_fecha ON public.asistencia_sesion USING btree (fecha);


--
-- Name: ix_ciclos_id; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX ix_ciclos_id ON public.ciclos USING btree (id);


--
-- Name: ix_grupos_id; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX ix_grupos_id ON public.grupos USING btree (id);


--
-- Name: ix_inscripciones_alumno_id; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX ix_inscripciones_alumno_id ON public.inscripciones USING btree (alumno_id);


--
-- Name: ix_inscripciones_ciclo_id; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX ix_inscripciones_ciclo_id ON public.inscripciones USING btree (ciclo_id);


--
-- Name: ix_inscripciones_fecha_pago; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX ix_inscripciones_fecha_pago ON public.inscripciones USING btree (fecha_pago);


--
-- Name: ix_inscripciones_validated_by_id; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX ix_inscripciones_validated_by_id ON public.inscripciones USING btree (validated_by_id);


--
-- Name: ix_users_curp; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE UNIQUE INDEX ix_users_curp ON public.users USING btree (curp);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_id; Type: INDEX; Schema: public; Owner: vsalazars
--

CREATE INDEX ix_users_id ON public.users USING btree (id);


--
-- Name: asistencia_registro asistencia_registro_inscripcion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT asistencia_registro_inscripcion_id_fkey FOREIGN KEY (inscripcion_id) REFERENCES public.inscripciones(id) ON DELETE CASCADE;


--
-- Name: asistencia_registro asistencia_registro_marcado_por_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT asistencia_registro_marcado_por_id_fkey FOREIGN KEY (marcado_por_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: asistencia_registro asistencia_registro_sesion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_registro
    ADD CONSTRAINT asistencia_registro_sesion_id_fkey FOREIGN KEY (sesion_id) REFERENCES public.asistencia_sesion(id) ON DELETE CASCADE;


--
-- Name: asistencia_sesion fk_asistencia_sesion_ciclo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencia_sesion
    ADD CONSTRAINT fk_asistencia_sesion_ciclo FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: ciclos fk_ciclos_docente; Type: FK CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.ciclos
    ADD CONSTRAINT fk_ciclos_docente FOREIGN KEY (docente_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: evaluaciones fk_evaluacion_ciclo; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT fk_evaluacion_ciclo FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: evaluaciones fk_evaluacion_inscripcion; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT fk_evaluacion_inscripcion FOREIGN KEY (inscripcion_id) REFERENCES public.inscripciones(id) ON DELETE CASCADE;


--
-- Name: evaluaciones fk_evaluacion_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluaciones
    ADD CONSTRAINT fk_evaluacion_user FOREIGN KEY (updated_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: inscripciones fk_inscripciones_validated_by_id_users; Type: FK CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT fk_inscripciones_validated_by_id_users FOREIGN KEY (validated_by_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: grupos grupos_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.grupos
    ADD CONSTRAINT grupos_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- Name: inscripciones inscripciones_alumno_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_alumno_id_fkey FOREIGN KEY (alumno_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: inscripciones inscripciones_ciclo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vsalazars
--

ALTER TABLE ONLY public.inscripciones
    ADD CONSTRAINT inscripciones_ciclo_id_fkey FOREIGN KEY (ciclo_id) REFERENCES public.ciclos(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

